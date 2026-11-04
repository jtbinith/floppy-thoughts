-- "Last edited" on any change, keeping an uploaded board's date, and whether a link is live.
begin;
create extension if not exists pgtap with schema extensions;
select plan(17);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'owner@example.com', '{"user_name": "owen"}'),
  ('00000000-0000-0000-0000-00000000000b', 'editor@example.com', '{"user_name": "edie"}');

create schema tests;
grant usage on schema tests to authenticated;
create function tests.act_as(uid text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claim.sub', uid, true),
         set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;
grant execute on all functions in schema tests to authenticated;

select tests.act_as('00000000-0000-0000-0000-00000000000a');
insert into public.boards (id, name) values ('10000000-0000-0000-0000-000000000001', 'Time');
reset role;
insert into public.board_members (board_id, user_id, role) values ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000b', 'editor');

-- (Inside one test everything happens at the same now(), so the board is first set a week back.)
select tests.act_as('00000000-0000-0000-0000-00000000000a');
select lives_ok($$ select public.keep_edited('10000000-0000-0000-0000-000000000001', now() - interval '7 days') $$, 'the owner keeps an uploaded board''s date');
select is((select updated_at from public.boards), now() - interval '7 days', 'and it''s kept');

select tests.act_as('00000000-0000-0000-0000-00000000000b');
update public.boards set name = 'Time and tides';
select is((select updated_at from public.boards), now(), 'renaming counts as an edit');

select tests.act_as('00000000-0000-0000-0000-00000000000a');
select public.keep_edited('10000000-0000-0000-0000-000000000001', now() + interval '1 year');
select is((select updated_at from public.boards), now(), 'a date in the future becomes now');

select tests.act_as('00000000-0000-0000-0000-00000000000b');
select throws_ok($$ select public.keep_edited('10000000-0000-0000-0000-000000000001', now() - interval '1 year') $$, '42501', null, 'only the owner can set the date');

-- Invite links can be copied again, by owners and admins only.
select tests.act_as('00000000-0000-0000-0000-00000000000a');
select is(public.invite_link('10000000-0000-0000-0000-000000000001'), null, 'no link to start with');
select set_config('tests.made', public.make_invite('10000000-0000-0000-0000-000000000001'), true);
select is(public.invite_link('10000000-0000-0000-0000-000000000001'), current_setting('tests.made'), 'the owner sees the same link again');
select tests.act_as('00000000-0000-0000-0000-00000000000b');
select throws_ok($$ select public.invite_link('10000000-0000-0000-0000-000000000001') $$, '42501', null, 'an editor can''t see it');
select throws_ok($$ select * from public.board_invites $$, '42501', null, 'and nobody reads the table directly');

-- Admins manage sharing and people, but can't delete the board or touch the owner.
select tests.act_as('00000000-0000-0000-0000-00000000000a');
select lives_ok($$ update public.board_members set role = 'admin' where user_id = '00000000-0000-0000-0000-00000000000b' $$, 'the owner makes someone an admin');
select tests.act_as('00000000-0000-0000-0000-00000000000b');
select ok(public.invite_link('10000000-0000-0000-0000-000000000001') is not null, 'an admin can copy the link');
select lives_ok($$ select public.make_invite('10000000-0000-0000-0000-000000000001') $$, 'and reset it');
select lives_ok($$ insert into public.nodes (id, board_id, number, text, kind, x, y) values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 1, 'clocks', 'user', 0, 0) $$, 'and edit, like an editor');
select throws_ok($$ update public.board_members set role = 'editor' where user_id = '00000000-0000-0000-0000-00000000000a' $$, 'P0001', null, 'but not demote the owner');
select lives_ok($$ delete from public.boards $$, 'deleting the board runs…');
reset role;
select is((select count(*)::int from public.boards), 1, '…but only the owner can, so it stays');

-- Who last edited a box is whoever did, whatever the app says.
select tests.act_as('00000000-0000-0000-0000-00000000000a');
select public.save_nodes('10000000-0000-0000-0000-000000000001', '[{"id": "20000000-0000-0000-0000-000000000001", "number": 1, "text": "water clocks", "kind": "user", "x": 0, "y": 0}]');
select results_eq($$ select created_by, updated_by from public.nodes $$,
  $$ values ('00000000-0000-0000-0000-00000000000b'::uuid, '00000000-0000-0000-0000-00000000000a'::uuid) $$, 'a box knows who added it and who edited it last');

select * from finish();
rollback;
