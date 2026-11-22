-- Folders: everyone has their own, nobody sees anyone else's, a folder can't go inside itself,
-- and you only file boards you're on. Run with `npm run db:test`.
begin;
create extension if not exists pgtap with schema extensions;
select plan(23);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'owner@example.com', '{"user_name": "owen"}'),
  ('00000000-0000-0000-0000-00000000000c', 'viewer@example.com', '{"user_name": "vic"}'),
  ('00000000-0000-0000-0000-00000000000d', 'stranger@example.com', '{"user_name": "stan"}');

create schema tests;
grant usage on schema tests to anon, authenticated;
create function tests.uid(who text) returns text language sql as $$
  select case who when 'owner' then '00000000-0000-0000-0000-00000000000a'
                  when 'viewer' then '00000000-0000-0000-0000-00000000000c'
                  else '00000000-0000-0000-0000-00000000000d' end
$$;
create function tests.act_as(who text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claim.sub', tests.uid(who), true),
         set_config('request.jwt.claims', json_build_object('sub', tests.uid(who), 'role', 'authenticated')::text, true);
$$;
create function tests.signed_out() returns void language sql as $$
  select set_config('role', 'anon', true), set_config('request.jwt.claim.sub', '', true),
         set_config('request.jwt.claims', '{"role": "anon"}', true);
$$;
grant execute on all functions in schema tests to anon, authenticated;
create temp table secrets (secret text);
grant all on secrets to authenticated;

-- The owner makes a board and shares it with a viewer.
select tests.act_as('owner');
insert into public.boards (id, name) values ('10000000-0000-0000-0000-000000000001', 'Time');
insert into secrets values (public.make_invite('10000000-0000-0000-0000-000000000001'));
select tests.act_as('viewer');
select public.join_board((select secret from secrets));

---------------------------------------------------------------------------------------------------
-- Making folders, and folders inside folders
select tests.act_as('owner');
select lives_ok($$ insert into public.folders (id, name) values ('30000000-0000-0000-0000-000000000001', 'Hackathons') $$, 'you make a folder');
select lives_ok($$ insert into public.folders (id, name, parent_id) values ('30000000-0000-0000-0000-000000000002', 'OxHack', '30000000-0000-0000-0000-000000000001') $$, 'and a folder inside it');
select lives_ok($$ insert into public.folders (id, name, parent_id) values ('30000000-0000-0000-0000-000000000003', 'Day 1', '30000000-0000-0000-0000-000000000002') $$, 'and one inside that');
select throws_ok($$ insert into public.folders (name) values ('   ') $$, '23514', null, 'a folder needs a name');
select throws_ok($$ insert into public.folders (name, user_id) values ('Mine now', '00000000-0000-0000-0000-00000000000c') $$, '42501', null, 'you can''t make a folder for someone else');
select lives_ok($$ update public.folders set name = 'Hacks' where id = '30000000-0000-0000-0000-000000000001' $$, 'you rename your folder');

-- No loops
select throws_ok($$ update public.folders set parent_id = '30000000-0000-0000-0000-000000000001' where id = '30000000-0000-0000-0000-000000000001' $$, '23514', null, 'a folder can''t go inside itself');
select throws_ok($$ update public.folders set parent_id = '30000000-0000-0000-0000-000000000003' where id = '30000000-0000-0000-0000-000000000001' $$, '23514', null, 'or inside a folder that''s inside it');
select lives_ok($$ update public.folders set parent_id = null where id = '30000000-0000-0000-0000-000000000003' $$, 'moving a folder to the top is fine');

---------------------------------------------------------------------------------------------------
-- Filing boards
select lives_ok($$ insert into public.board_folders (board_id, folder_id) values ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002') $$, 'you put your board in a folder');
select lives_ok($$ update public.board_folders set folder_id = '30000000-0000-0000-0000-000000000003' where board_id = '10000000-0000-0000-0000-000000000001' $$, 'and move it to another one');

select tests.act_as('viewer');
select is((select count(*)::int from public.folders), 0, 'nobody else sees your folders');
select is((select count(*)::int from public.board_folders), 0, 'or where you filed a board, even one they''re on');
select lives_ok($$ insert into public.folders (id, name) values ('30000000-0000-0000-0000-000000000009', 'Shared with me') $$, 'they make their own folder');
select lives_ok($$ insert into public.board_folders (board_id, folder_id) values ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000009') $$, 'and file the shared board in it, their own way');
select throws_ok($$ insert into public.folders (name, parent_id) values ('Sneaky', '30000000-0000-0000-0000-000000000001') $$, '23503', null, 'they can''t put a folder inside yours');
select throws_ok($$ update public.board_folders set folder_id = '30000000-0000-0000-0000-000000000002' where board_id = '10000000-0000-0000-0000-000000000001' $$, '23503', null, 'or file a board in your folder');

select tests.act_as('stranger');
insert into public.folders (id, name) values ('30000000-0000-0000-0000-00000000000e', 'Nosy');
select throws_ok($$ insert into public.board_folders (board_id, folder_id) values ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-00000000000e') $$, '42501', null, 'you can''t file a board you''re not on');

---------------------------------------------------------------------------------------------------
-- Leaving and deleting
select tests.act_as('viewer');
delete from public.board_members where user_id = auth.uid();
select is((select count(*)::int from public.board_folders), 0, 'leaving a board takes it out of your folders');

select tests.act_as('owner');
delete from public.folders where id = '30000000-0000-0000-0000-000000000001';
select is((select count(*)::int from public.folders where id = '30000000-0000-0000-0000-000000000002'), 0, 'deleting a folder deletes the folders inside it');
select is((select count(*)::int from public.boards), 1, '(the boards themselves stay)');

select tests.signed_out();
select throws_ok($$ select count(*) from public.folders $$, '42501', null, 'signed out, there''s no access to folders');
select throws_ok($$ select count(*) from public.board_folders $$, '42501', null, 'or to where boards are filed');

select * from finish();
rollback;
