-- Who can do what on a shared board: an owner, an editor, a viewer, a stranger (signed in, not
-- on the board) and someone signed out each try everything. Run with `npm run db:test`.
begin;
create extension if not exists pgtap with schema extensions;
select plan(57);

-- People, as the database sees them after signing in with GitHub.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'owner@example.com', '{"user_name": "owen", "avatar_url": "https://example.com/o.png"}'),
  ('00000000-0000-0000-0000-00000000000b', 'editor@example.com', '{"user_name": "edie"}'),
  ('00000000-0000-0000-0000-00000000000c', 'viewer@example.com', '{"user_name": "vic"}'),
  ('00000000-0000-0000-0000-00000000000d', 'stranger@example.com', '{"user_name": "stan"}');

-- Acting as someone: the role the API uses, and who the sign-in says you are.
create schema tests;
grant usage on schema tests to anon, authenticated;
create function tests.uid(who text) returns text language sql as $$
  select case who when 'owner' then '00000000-0000-0000-0000-00000000000a'
                  when 'editor' then '00000000-0000-0000-0000-00000000000b'
                  when 'viewer' then '00000000-0000-0000-0000-00000000000c'
                  else '00000000-0000-0000-0000-00000000000d' end
$$;
-- Both ways the signed-in user is passed (newer and older versions of Supabase's auth.uid()).
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

-- Profiles come from GitHub.
select is((select name from public.profiles where id = '00000000-0000-0000-0000-00000000000a'), 'owen', 'a profile is made from the GitHub name');

---------------------------------------------------------------------------------------------------
-- The owner makes a board, with two boxes and a link.
select tests.act_as('owner');
select lives_ok($$ insert into public.boards (id, name) values ('10000000-0000-0000-0000-000000000001', 'Time') $$, 'anyone signed in can make a board');
select is((select role from public.board_members where board_id = '10000000-0000-0000-0000-000000000001' and user_id = auth.uid()), 'owner', 'whoever makes it is its owner');
select lives_ok($$ insert into public.nodes (id, board_id, number, text, kind, category, locked, x, y) values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 1, 'Time', 'spark', 'theme', true, 0, 0),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 2, 'clocks', 'user', null, null, 10, 10) $$, 'the owner adds boxes');
select lives_ok($$ insert into public.links (board_id, node_a, node_b) values
  ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002') $$, 'the owner links them');
select throws_ok($$ insert into public.boards (name, owner_id) values ('not mine', '00000000-0000-0000-0000-00000000000d') $$, '42501', null, 'you can''t make a board in someone else''s name');

-- Sharing: the owner makes an invite link. Only its hash is kept.
select ok(char_length(public.make_invite('10000000-0000-0000-0000-000000000001')) = 48, 'the owner makes an invite link');
reset role;
create temp table secrets (who text, secret text);
grant all on secrets to authenticated;
select tests.act_as('owner');
insert into secrets values ('first', public.make_invite('10000000-0000-0000-0000-000000000001'));
reset role;
select is((select token from public.board_invites), (select secret from secrets), 'the newest link is the live one');

-- The editor joins through the link; the viewer joins and the owner makes them a viewer.
select tests.act_as('editor');
select is(public.join_board((select secret from secrets)), '10000000-0000-0000-0000-000000000001'::uuid, 'the link takes you onto the board');
select is(private.role_on('10000000-0000-0000-0000-000000000001'), 'editor', 'joining makes you an editor');
select is(public.join_board('not-the-secret'), null, 'a wrong link does nothing');
select tests.act_as('viewer');
select public.join_board((select secret from secrets));
select tests.act_as('owner');
select lives_ok($$ update public.board_members set role = 'viewer' where user_id = '00000000-0000-0000-0000-00000000000c' $$, 'the owner can make someone a viewer');
reset role;
select is((select role from public.board_members where user_id = '00000000-0000-0000-0000-00000000000c'), 'viewer', 'and they are one');

---------------------------------------------------------------------------------------------------
-- The editor
select tests.act_as('editor');
select is((select count(*)::int from public.nodes), 2, 'the editor sees the boxes');
select lives_ok($$ insert into public.nodes (id, board_id, number, text, kind, x, y) values
  ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 3, 'sundials', 'user', 20, 20) $$, 'the editor adds a box');
select lives_ok($$ update public.nodes set text = 'water clocks' where id = '20000000-0000-0000-0000-000000000002' $$, 'the editor edits a box');
select lives_ok($$ update public.boards set name = 'Time and tides' where id = '10000000-0000-0000-0000-000000000001' $$, 'the editor renames the board');
select lives_ok($$ insert into public.favourites (board_id, node_id) values ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002') $$, 'the editor favourites a box');
select throws_ok($$ select public.make_invite('10000000-0000-0000-0000-000000000001') $$, '42501', null, 'the editor can''t share the board');
select lives_ok($$ update public.board_members set role = 'viewer' where user_id = '00000000-0000-0000-0000-00000000000c' $$, 'a role change by the editor runs…');
reset role;
select tests.act_as('owner');
select throws_ok($$ update public.board_members set role = 'owner' where user_id = '00000000-0000-0000-0000-00000000000b' $$, 'P0001', null, 'a board can''t get a second owner');
select tests.act_as('editor');
select is(private.role_on('10000000-0000-0000-0000-000000000001'), 'editor', '…but only the owner changes roles');
select is((select count(*)::int from public.board_members where role = 'viewer'), 1, 'the editor sees who else is on the board');
select lives_ok($$ delete from public.boards where id = '10000000-0000-0000-0000-000000000001' $$, 'a delete by the editor runs…');
reset role;
select is((select count(*)::int from public.boards), 1, '…but the board isn''t deleted');
select is((select created_by from public.nodes where number = 3), '00000000-0000-0000-0000-00000000000b'::uuid, 'every box records who added it');
select tests.act_as('editor');
select throws_ok($$ update public.nodes set created_by = auth.uid() where number = 1 $$, '42501', null, 'who added a box can''t be changed');

---------------------------------------------------------------------------------------------------
-- The viewer
select tests.act_as('viewer');
select is((select count(*)::int from public.nodes), 3, 'the viewer sees the boxes');
select is((select count(*)::int from public.links), 1, 'and the links');
select is((select name from public.profiles where id = '00000000-0000-0000-0000-00000000000b'), 'edie', 'and the names of people on the board');
select throws_ok($$ insert into public.nodes (id, board_id, number, text, kind, x, y) values
  ('20000000-0000-0000-0000-000000000009', '10000000-0000-0000-0000-000000000001', 9, 'nope', 'user', 0, 0) $$, '42501', null, 'the viewer can''t add a box');
select lives_ok($$ update public.nodes set text = 'nope' where number = 2 $$, 'an edit by the viewer runs…');
reset role;
select is((select text from public.nodes where number = 2), 'water clocks', '…but changes nothing');
select tests.act_as('viewer');
select throws_ok($$ insert into public.links (board_id, node_a, node_b) values
  ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000003') $$, '42501', null, 'the viewer can''t link');
select lives_ok($$ insert into public.favourites (board_id, node_id) values ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002') $$, 'the viewer can favourite');
select throws_ok($$ insert into public.favourites (board_id, node_id, user_id) values ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-00000000000b') $$, '42501', null, 'but not for someone else');
select lives_ok($$ delete from public.favourites where user_id = '00000000-0000-0000-0000-00000000000b' $$, 'unfavouriting someone else''s favourite runs…');
reset role;
select is((select count(*)::int from public.favourites), 2, '…but it stays');

---------------------------------------------------------------------------------------------------
-- A stranger (signed in, not on the board)
select tests.act_as('stranger');
select is((select count(*)::int from public.boards), 0, 'a stranger can''t see the board exists');
select is((select count(*)::int from public.nodes), 0, 'or its boxes');
select is((select count(*)::int from public.links), 0, 'or its links');
select is((select count(*)::int from public.favourites), 0, 'or its favourites');
select is((select count(*)::int from public.board_members), 0, 'or who''s on it');
select is((select count(*)::int from public.profiles where id <> auth.uid()), 0, 'or anyone''s name');
select throws_ok($$ insert into public.nodes (id, board_id, number, text, kind, x, y) values
  ('20000000-0000-0000-0000-000000000008', '10000000-0000-0000-0000-000000000001', 8, 'sneaky', 'user', 0, 0) $$, '42501', null, 'a stranger can''t add to it');
select throws_ok($$ select * from public.board_invites $$, '42501', null, 'nobody can read invite links, even hashed');

---------------------------------------------------------------------------------------------------
-- Someone signed out
select tests.signed_out();
select throws_ok($$ select * from public.boards $$, '42501', null, 'signed out, boards are closed');
select throws_ok($$ select * from public.nodes $$, '42501', null, 'and boxes');
select throws_ok($$ select public.join_board('anything') $$, '42501', null, 'and invite links can''t be used');

---------------------------------------------------------------------------------------------------
-- Leaving, removing, stopping the link, deleting
select tests.act_as('viewer');
select lives_ok($$ delete from public.board_members where user_id = auth.uid() $$, 'anyone can leave a board');
select is((select count(*)::int from public.nodes), 0, 'and then they no longer see it');
select tests.act_as('owner');
select lives_ok($$ delete from public.board_members where role = 'owner' $$, 'the owner''s own leave runs…');
select is(private.role_on('10000000-0000-0000-0000-000000000001'), 'owner', '…but they''re still the owner (they delete the board instead)');
select lives_ok($$ select public.stop_invite('10000000-0000-0000-0000-000000000001') $$, 'the owner turns the link off');
select tests.act_as('viewer');
select is(public.join_board((select secret from secrets)), null, 'an old link no longer works');
select tests.act_as('owner');
select lives_ok($$ delete from public.boards where id = '10000000-0000-0000-0000-000000000001' $$, 'the owner deletes the board');
reset role;
select is((select count(*)::int from public.nodes), 0, 'and everything on it goes too');

select * from finish();
rollback;
