-- =====================================================================
-- OURCAMPUS — Supabase schema, security rules and account functions
-- Apply with the Supabase CLI (`supabase db push`) or paste into SQL Editor and Run.
-- Idempotent: safe to run again.
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------- tables ----------
create table if not exists public.profiles (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  login_id     text unique not null,                       -- e.g. ST-1001, SF-201, ADMIN
  role         text not null check (role in ('Student','Staff','Admin','Principal','Vice Principal')),
  person_id    bigint,                                      -- student id / staff id inside records
  display_name text not null,
  created_at   timestamptz not null default now()
);

create table if not exists public.records (
  collection  text   not null,                              -- students, staff, attendance, leaves, …
  key         text   not null,                              -- record id inside the collection
  student_id  bigint,                                       -- owner student (used by security rules)
  data        jsonb  not null,
  updated_at  timestamptz not null default now(),
  updated_by  uuid default auth.uid(),
  primary key (collection, key)
);
create index if not exists records_collection_idx on public.records (collection);
create index if not exists records_student_idx    on public.records (student_id);

-- one active/requested lab pass per seat per day, and one per student per day
create unique index if not exists lab_seat_once on public.records ((data->>'date'), (data->>'seat'))
  where collection = 'labBookings' and data->>'status' in ('Active','Requested');
create unique index if not exists lab_student_once on public.records ((data->>'date'), student_id)
  where collection = 'labBookings' and data->>'status' in ('Active','Requested');

create table if not exists public.notifications (
  id          bigint primary key,
  audience    text[] not null,                              -- e.g. {student:1}, {role:Principal}, {position:Librarian}, {all}
  data        jsonb  not null,
  read_by     text[] not null default '{}',
  handled     boolean not null default false,
  created_by  uuid default auth.uid(),
  created_at  timestamptz not null default now()
);
create index if not exists notifications_audience_idx on public.notifications using gin (audience);

-- keep updated_at / updated_by current
create or replace function public.touch_record() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end $$;
drop trigger if exists records_touch on public.records;
create trigger records_touch before update on public.records
  for each row execute function public.touch_record();

-- ---------- identity helpers ----------
create or replace function public.app_role() returns text
language sql stable security definer set search_path = public as $$
  select role from profiles where user_id = auth.uid()
$$;

create or replace function public.app_person() returns bigint
language sql stable security definer set search_path = public as $$
  select person_id from profiles where user_id = auth.uid()
$$;

create or replace function public.app_positions() returns text[]
language sql stable security definer set search_path = public as $$
  select coalesce((
    select array_agg(x)
    from profiles p
    join records r on r.collection = 'staff' and r.key = p.person_id::text
    cross join lateral jsonb_array_elements_text(coalesce(r.data->'positions','[]'::jsonb)) x
    where p.user_id = auth.uid() and p.role = 'Staff'
  ), '{}'::text[])
$$;

create or replace function public.my_keys() returns text[]
language plpgsql stable security definer set search_path = public as $$
declare r text := app_role(); pid bigint := app_person();
begin
  if r is null then return '{}'; end if;
  if r = 'Student' then return array['student:'||pid, 'all', 'students']; end if;
  if r = 'Staff' then
    return array['staff:'||pid, 'all', 'staffAll']
        || coalesce((select array_agg('position:'||x) from unnest(app_positions()) x), '{}'::text[]);
  end if;
  return array['role:'||r, 'all', 'staffAll'];
end $$;

create or replace function public.my_viewer_key() returns text
language sql stable security definer set search_path = public as $$
  select case app_role() when 'Student' then 'student:'||app_person()
                         when 'Staff'   then 'staff:'||app_person()
                         else 'role:'||app_role() end
$$;

-- ---------- who may write what ----------
create or replace function public.can_write(coll text, k text, sid bigint, d jsonb, op text) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare r text := app_role(); pid bigint := app_person(); pos text[]; st text := d->>'status';
begin
  if r is null then return false; end if;
  if r = 'Admin' then return true; end if;

  if r = 'Student' then
    if sid is distinct from pid then return false; end if;
    if op = 'insert' then
      return case coll
        when 'leaves'      then st = 'Pending'
        when 'medical'     then st = 'Pending'
        when 'requests'    then st = 'Submitted'
        when 'feeTasks'    then st = 'Pending'
        when 'formSubs'    then true
        when 'labBookings' then st = 'Requested'
             or (st = 'Active' and coalesce((select data->>'labMode' from records where collection='meta' and key='settings'),'') = 'Instant')
        else false end;
    end if;
    return coll = 'labBookings' and st = 'Cancelled';
  end if;

  if r in ('Principal','Vice Principal') then
    return coll in ('leaves','feeTasks','fees','announcements');
  end if;

  -- Staff: what they can do depends on their positions
  pos := app_positions();
  if coll in ('attendance','attSubs','followups','marks') then return true; end if;
  if coll in ('leaves','medical') then return 'Academic Assistant' = any(pos); end if;
  if coll = 'requests'    then return op = 'update' and ('Academic Assistant' = any(pos) or 'Librarian' = any(pos)); end if;
  if coll = 'libStatus'   then return 'Librarian' = any(pos); end if;
  if coll = 'labBookings' then return 'Lab Charge' = any(pos); end if;
  if coll = 'meta'        then return k = 'labUnavailable' and 'Lab Charge' = any(pos); end if;
  return false;
end $$;

-- ---------- row level security ----------
alter table public.profiles      enable row level security;
alter table public.records       enable row level security;
alter table public.notifications enable row level security;

drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select to authenticated
  using (user_id = auth.uid() or app_role() = 'Admin');

drop policy if exists records_read   on public.records;
drop policy if exists records_insert on public.records;
drop policy if exists records_update on public.records;
drop policy if exists records_delete on public.records;

create policy records_read on public.records for select to authenticated using (
  case app_role()
    when 'Student' then student_id = app_person() or collection in ('meta','staff','forms','announcements')
    when 'Staff'   then collection not in ('fees','feeTasks')
    when 'Admin'   then true
    when 'Principal' then true
    when 'Vice Principal' then true
    else false end);

create policy records_insert on public.records for insert to authenticated
  with check (can_write(collection, key, student_id, data, 'insert'));

create policy records_update on public.records for update to authenticated
  using (app_role() is not null and (app_role() <> 'Student' or student_id = app_person()))
  with check (can_write(collection, key, student_id, data, 'update'));

create policy records_delete on public.records for delete to authenticated
  using (app_role() = 'Admin' or (app_role() = 'Staff' and collection = 'marks'));

drop policy if exists notifications_read   on public.notifications;
drop policy if exists notifications_insert on public.notifications;
create policy notifications_read on public.notifications for select to authenticated
  using (audience && my_keys() or created_by = auth.uid());
-- students may only notify staff-side queues, never other students or everyone
create policy notifications_insert on public.notifications for insert to authenticated
  with check (app_role() is not null and (app_role() <> 'Student' or not exists (
    select 1 from unnest(audience) a
    where a in ('all','students','staffAll') or a like 'student:%' or a like 'staff:%')));

-- ---------- notification actions ----------
create or replace function public.mark_read(ids bigint[]) returns void
language sql security definer set search_path = public as $$
  update notifications set read_by = array_append(read_by, my_viewer_key())
  where id = any(ids) and audience && my_keys() and not (my_viewer_key() = any(read_by))
$$;

create or replace function public.mark_handled(ids bigint[]) returns void
language sql security definer set search_path = public as $$
  update notifications set handled = true where id = any(ids) and app_role() is not null
$$;

-- lab seat availability for everyone (seat + status only, no names)
create or replace function public.lab_seats(d text)
returns table (seat int, status text, mine boolean)
language sql stable security definer set search_path = public as $$
  select (data->>'seat')::int, data->>'status', student_id = app_person()
  from records
  where app_role() is not null and collection = 'labBookings'
    and data->>'date' = d and data->>'status' in ('Active','Requested')
$$;

-- ---------- accounts ----------
-- Sign-in accounts are created through the API server (Supabase Admin API, service-role key)
-- or with `npm run accounts:create`. The browser can never create, reset or delete accounts.

grant execute on function public.mark_read(bigint[]) to authenticated;
grant execute on function public.mark_handled(bigint[]) to authenticated;
grant execute on function public.lab_seats(text) to authenticated;
revoke execute on function public.mark_read(bigint[]) from anon;
revoke execute on function public.mark_handled(bigint[]) from anon;
revoke execute on function public.lab_seats(text) from anon;
