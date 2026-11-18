-- OURCAMPUS — 18 Nov 2026
-- 1. Students can't book a lab seat that the Admin / Lab Charge marked unavailable.
-- 2. The class teacher (assigned by the Admin in Staff Management) can save the
--    seating plan for their class (records collection "seating", key = class name).
-- Safe to run more than once.
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
        when 'labBookings' then
          (st = 'Requested'
             or (st = 'Active' and coalesce((select data->>'labMode' from records where collection='meta' and key='settings'),'') = 'Instant'))
          and not exists (
            select 1 from records
            where collection = 'meta' and key = 'labUnavailable'
              and coalesce(data->'list', '[]'::jsonb) @> jsonb_build_array((d->>'seat')::int)
          )
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
  if coll = 'seating'     then
    return coalesce((select data->'classTeachers'->>k from records where collection = 'meta' and key = 'settings'), '') = pid::text;
  end if;
  return false;
end $$;
