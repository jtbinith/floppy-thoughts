-- Deleting your account: your own only, your boards go, your boxes on others' boards stay.
begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'owner@example.com', '{"user_name": "owen"}'),
  ('00000000-0000-0000-0000-00000000000b', 'editor@example.com', '{"user_name": "edie"}');
create schema tests;
grant usage on schema tests to anon, authenticated;
create function tests.act_as(uid text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claim.sub', uid, true),
         set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;
grant execute on all functions in schema tests to anon, authenticated;

-- Owen's board, which Edie is on and adds to; and Edie's own board.
select tests.act_as('00000000-0000-0000-0000-00000000000a');
insert into public.boards (id, name) values ('10000000-0000-0000-0000-000000000001', 'Owen''s');
reset role;
insert into public.board_members (board_id, user_id, role) values ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000b', 'editor');
select tests.act_as('00000000-0000-0000-0000-00000000000b');
insert into public.nodes (id, board_id, number, text, kind, x, y) values ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 1, 'edie''s idea', 'user', 0, 0);
insert into public.favourites (board_id, node_id) values ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001');
insert into public.boards (id, name) values ('10000000-0000-0000-0000-000000000002', 'Edie''s');

select lives_ok($$ select public.delete_my_account() $$, 'Edie deletes her account');
reset role;
select is((select count(*)::int from auth.users where id = '00000000-0000-0000-0000-00000000000b'), 0, 'her account is gone');
select is((select count(*)::int from public.profiles where id = '00000000-0000-0000-0000-00000000000b'), 0, 'and her name and picture');
select is((select count(*)::int from public.boards where id = '10000000-0000-0000-0000-000000000002'), 0, 'and the board she owned');
select is((select count(*)::int from public.favourites), 0, 'and her favourites');
select results_eq($$ select text, created_by, updated_by from public.nodes $$, $$ values ('edie''s idea', null::uuid, null::uuid) $$, 'her box on Owen''s board stays, without her name');
select is((select count(*)::int from auth.users where id = '00000000-0000-0000-0000-00000000000a'), 1, 'and nobody else is touched');

select set_config('role', 'anon', true), set_config('request.jwt.claim.sub', '', true);
select throws_ok($$ select public.delete_my_account() $$, '42501', null, 'signed out, there''s nothing to delete');

select * from finish();
rollback;
