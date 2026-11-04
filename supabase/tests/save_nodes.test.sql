-- save_nodes: adding and editing boxes in one go, under the same rules as everything else.
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'owner@example.com', '{"user_name": "owen"}'),
  ('00000000-0000-0000-0000-00000000000c', 'viewer@example.com', '{"user_name": "vic"}'),
  ('00000000-0000-0000-0000-00000000000d', 'stranger@example.com', '{"user_name": "stan"}');

create schema tests;
grant usage on schema tests to authenticated;
create function tests.act_as(uid text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claim.sub', uid, true),
         set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;
grant execute on all functions in schema tests to authenticated;

-- Two boards of the owner's; the viewer is a viewer on the first.
select tests.act_as('00000000-0000-0000-0000-00000000000a');
insert into public.boards (id, name) values ('10000000-0000-0000-0000-000000000001', 'Time'), ('10000000-0000-0000-0000-000000000002', 'Other');
reset role;
insert into public.board_members (board_id, user_id, role) values ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000c', 'viewer');

select tests.act_as('00000000-0000-0000-0000-00000000000a');
select lives_ok($$ select public.save_nodes('10000000-0000-0000-0000-000000000001', '[
  {"id": "20000000-0000-0000-0000-000000000001", "number": 1, "text": "Time", "kind": "spark", "category": "theme", "locked": true, "x": 0, "y": 0},
  {"id": "20000000-0000-0000-0000-000000000002", "number": 2, "text": "clocks", "kind": "user", "x": 5, "y": 5}]') $$, 'the owner adds boxes');
select lives_ok($$ select public.save_nodes('10000000-0000-0000-0000-000000000001', '[
  {"id": "20000000-0000-0000-0000-000000000002", "number": 2, "text": "water clocks", "kind": "user", "x": 50, "y": 60},
  {"id": "20000000-0000-0000-0000-000000000003", "number": 3, "text": "tides", "kind": "user", "x": 9, "y": 9}]') $$, 'and edits one while adding another');
select results_eq($$ select number, text, x from public.nodes order by number $$,
  $$ values (1, 'Time', 0::float8), (2, 'water clocks', 50::float8), (3, 'tides', 9::float8) $$, 'the edit and the new box are saved');
select is((select created_by from public.nodes where number = 3), '00000000-0000-0000-0000-00000000000a'::uuid, 'new boxes record who added them');

select lives_ok($$ select public.save_nodes('10000000-0000-0000-0000-000000000002', '[
  {"id": "20000000-0000-0000-0000-000000000002", "number": 2, "text": "moved?", "kind": "user", "x": 0, "y": 0}]') $$, 'saving a box under another board runs…');
select is((select board_id from public.nodes where number = 2 and text = 'water clocks'), '10000000-0000-0000-0000-000000000001'::uuid, '…but the box stays where it was');

select tests.act_as('00000000-0000-0000-0000-00000000000c');
select throws_ok($$ select public.save_nodes('10000000-0000-0000-0000-000000000001', '[
  {"id": "20000000-0000-0000-0000-000000000009", "number": 9, "text": "nope", "kind": "user", "x": 0, "y": 0}]') $$, '42501', null, 'a viewer can''t add boxes');
select throws_ok($$ select public.save_nodes('10000000-0000-0000-0000-000000000001', '[
  {"id": "20000000-0000-0000-0000-000000000002", "number": 2, "text": "nope", "kind": "user", "x": 0, "y": 0}]') $$, '42501', null, 'or change them');

select tests.act_as('00000000-0000-0000-0000-00000000000d');
select throws_ok($$ select public.save_nodes('10000000-0000-0000-0000-000000000001', '[
  {"id": "20000000-0000-0000-0000-000000000008", "number": 8, "text": "sneaky", "kind": "user", "x": 0, "y": 0}]') $$, '42501', null, 'and nor can a stranger');

select * from finish();
rollback;
