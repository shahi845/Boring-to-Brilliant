-- Row Level Security tests. Each check prints PASS/FAIL. Run with: npm run test:db
\set ON_ERROR_STOP 0
\set QUIET 1
create extension if not exists pgcrypto with schema extensions;
-- fixtures: users + profiles
create or replace function t_user(lid text, r text, pid bigint) returns void language plpgsql as $$
declare u uuid := gen_random_uuid(); begin
  insert into auth.users(id,email) values (u, lower(lid)||'@ourcampus.app');
  insert into profiles(user_id,login_id,role,person_id,display_name) values (u,lid,r,pid,lid); end $$;
select t_user('ADMIN','Admin',null), t_user('PRINCIPAL','Principal',null), t_user('VICEPRINCIPAL','Vice Principal',null),
       t_user('SF-201','Staff',1), t_user('SF-202','Staff',2), t_user('SF-203','Staff',3), t_user('ST-1001','Student',1), t_user('ST-1002','Student',2);
insert into records(collection,key,student_id,data) values
 ('meta','settings',null,'{"labMode":"Approval"}'),
 ('staff','1',null,'{"id":1,"positions":["Teacher / Usthad","Lab Charge"]}'),
 ('staff','2',null,'{"id":2,"positions":["Teacher / Usthad","Librarian"]}'),
 ('staff','3',null,'{"id":3,"positions":["Academic Assistant"]}'),
 ('students','1',1,'{"id":1}'),('students','2',2,'{"id":2}'),
 ('leaves','10',2,'{"id":10,"status":"Pending"}'),('fees','5',1,'{"id":5,"status":"Pending"}');
insert into notifications(id,audience,data) values (1,'{role:Principal}','{}'),(2,'{student:1}','{}'),(3,'{position:Lab Charge}','{}');
create or replace function t_as(lid text) returns void language plpgsql security definer as $$
begin perform set_config('request.jwt.claim.sub',(select user_id::text from profiles where login_id=lid),false); end $$;
grant execute on function t_as(text) to authenticated;
-- assertion helpers
create or replace function t_ok(name text, cond boolean) returns text language sql as $$ select case when cond then 'PASS ' else 'FAIL ' end || name $$;
create or replace function t_denied(name text, stmt text) returns text language plpgsql as $$
begin execute stmt; return 'FAIL '||name||' (was allowed)'; exception when others then return 'PASS '||name; end $$;
create or replace function t_rows(stmt text) returns bigint language plpgsql as $$
declare n bigint; begin execute stmt; get diagnostics n = row_count; return n; end $$;
grant execute on function t_rows(text) to authenticated;
create or replace function t_allowed(name text, stmt text) returns text language plpgsql as $$
begin execute stmt; return 'PASS '||name; exception when others then return 'FAIL '||name||': '||sqlerrm; end $$;
grant execute on function t_ok(text,boolean), t_denied(text,text), t_allowed(text,text) to authenticated;
set role authenticated;
\pset tuples_only on
\pset format unaligned

select t_as('ST-1001');
select t_ok('student sees only own student & fee rows', (select count(*) from records where collection in ('students','fees','leaves')) = 2);
select t_ok('student cannot read other students', not exists(select 1 from records where collection='students' and key='2'));
select t_allowed('student can apply for leave', $q$insert into records values('leaves','11',1,'{"id":11,"status":"Pending"}')$q$);
select t_denied('student cannot insert approved leave', $q$insert into records values('leaves','12',1,'{"id":12,"status":"Approved"}')$q$);
select t_denied('student cannot apply for another student', $q$insert into records values('leaves','13',2,'{"id":13,"status":"Pending"}')$q$);
select t_denied('student cannot approve own leave', $q$update records set data='{"id":11,"status":"Approved"}' where collection='leaves' and key='11'$q$);
select t_denied('student cannot get instant lab pass in approval mode', $q$insert into records values('labBookings','51',1,'{"id":51,"seat":5,"date":"2030-01-01","status":"Active"}')$q$);
select t_allowed('student can request a lab seat', $q$insert into records values('labBookings','50',1,'{"id":50,"seat":4,"date":"2030-01-01","status":"Requested"}')$q$);
select t_allowed('student can cancel own lab pass', $q$update records set data=data||'{"status":"Cancelled"}' where collection='labBookings' and key='50'$q$);
select t_denied('student cannot notify everyone', $q$insert into notifications(id,audience,data) values (9,'{all}','{}')$q$);
select t_allowed('student can notify reviewers', $q$insert into notifications(id,audience,data) values (10,'{role:Principal}','{}')$q$);
select t_ok('student sees only own notifications', (select array_agg(id order by id) from notifications) = '{2,10}');
select mark_read(array[2::bigint]) \g /dev/null
select t_ok('mark_read records the reader', (select read_by from notifications where id=2) = '{student:1}');
select t_ok('student cannot delete records', t_rows($q$delete from records$q$) = 0);

select t_as('SF-201');
select t_ok('staff cannot see fees', (select count(*) from records where collection='fees') = 0);
select t_allowed('teacher can record attendance', $q$insert into records values('attendance','100',2,'{"id":100,"status":"Present"}')$q$);
select t_denied('teacher cannot approve leave', $q$update records set data='{"id":10,"status":"Approved"}' where collection='leaves' and key='10'$q$);
select t_allowed('lab charge can manage passes', $q$insert into records values('labBookings','52',2,'{"id":52,"seat":4,"date":"2030-01-02","status":"Active"}')$q$);
select t_denied('teacher cannot change settings', $q$update records set data='{}' where collection='meta' and key='settings'$q$);

select t_as('SF-202');
select t_denied('librarian cannot approve leave', $q$update records set data='{"id":10,"status":"Approved"}' where collection='leaves' and key='10'$q$);
select t_allowed('librarian can update library status', $q$insert into records values('libStatus','1',1,'{"status":"Cleared"}')$q$);

select t_as('SF-203');
select t_allowed('academic assistant can clear leave', $q$update records set data='{"id":10,"status":"Awaiting Clearance"}' where collection='leaves' and key='10'$q$);
select t_denied('academic assistant cannot edit library status', $q$insert into records values('libStatus','2',2,'{"status":"Cleared"}')$q$);

select t_as('PRINCIPAL');
select t_allowed('principal can decide leave', $q$update records set data='{"id":10,"status":"Approved"}' where collection='leaves' and key='10'$q$);
select t_denied('principal cannot edit staff positions', $q$insert into records values('staff','9',null,'{}')$q$);

select t_as('ADMIN');
select t_allowed('admin can edit staff positions', $q$update records set data='{"id":1,"positions":["Teacher / Usthad"]}' where collection='staff' and key='1'$q$);
select t_denied('one active pass per seat per day', $q$insert into records values('labBookings','53',2,'{"id":53,"seat":4,"date":"2030-01-02","status":"Requested"}')$q$);
select t_ok('lab_seats shows occupancy without names', (select count(*) from lab_seats('2030-01-02')) = 1);

select t_as('ST-1002');
select t_ok('users see only their own profile', (select count(*) from profiles) = 1);
reset role;
set role anon;
select t_ok('signed-out visitors (anon) see no records', (select count(*) from records) = 0);
select t_ok('signed-out visitors (anon) see no profiles', (select count(*) from profiles) = 0);
reset role;
