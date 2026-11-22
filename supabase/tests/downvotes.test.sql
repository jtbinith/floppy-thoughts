-- Down-votes: who can down-vote, who sees them, and that an idea is favourited or down-voted by
-- each person, never both. Run with `npm run db:test`.
begin;
create extension if not exists pgtap with schema extensions;
select plan(17);

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

-- The owner makes a board with one idea, and shares it with a viewer.
select tests.act_as('owner');
insert into public.boards (id, name) values ('10000000-0000-0000-0000-000000000001', 'Time');
insert into public.nodes (id, board_id, number, text, kind, x, y) values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 1, 'a pocket sundial', 'user', 0, 0);
insert into secrets values (public.make_invite('10000000-0000-0000-0000-000000000001'));
select tests.act_as('viewer');
select public.join_board((select secret from secrets));
select tests.act_as('owner');
update public.board_members set role = 'viewer' where user_id = '00000000-0000-0000-0000-00000000000c';

---------------------------------------------------------------------------------------------------
-- Down-voting
select tests.act_as('owner');
select lives_ok($$ insert into public.downvotes (board_id, node_id) values ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001') $$, 'the owner down-votes an idea');
select tests.act_as('viewer');
select lives_ok($$ insert into public.downvotes (board_id, node_id) values ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001') $$, 'a viewer can down-vote too');
select is((select count(*)::int from public.downvotes), 2, 'everyone on the board sees every down-vote (for the count)');
select throws_ok($$ insert into public.downvotes (board_id, node_id) values ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001') $$, '23505', null, 'one down-vote per person per idea');
select throws_ok($$ insert into public.downvotes (board_id, node_id, user_id) values ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000d') $$, '42501', null, 'you can''t down-vote for someone else');
select lives_ok($$ delete from public.downvotes where user_id = '00000000-0000-0000-0000-00000000000a' $$, 'taking back someone else''s down-vote runs…');
reset role;
select is((select count(*)::int from public.downvotes), 2, '…but it stays');

---------------------------------------------------------------------------------------------------
-- Favourite or down-vote, not both
select tests.act_as('viewer');
select lives_ok($$ insert into public.favourites (board_id, node_id) values ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001') $$, 'the viewer changes their mind and favourites it');
reset role;
select is((select count(*)::int from public.downvotes where user_id = '00000000-0000-0000-0000-00000000000c'), 0, 'favouriting takes away their down-vote');
select is((select count(*)::int from public.downvotes where user_id = '00000000-0000-0000-0000-00000000000a'), 1, '(and only theirs: the owner''s stays)');
select tests.act_as('viewer');
select lives_ok($$ insert into public.downvotes (board_id, node_id) values ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001') $$, 'and back again');
reset role;
select is((select count(*)::int from public.favourites where user_id = '00000000-0000-0000-0000-00000000000c'), 0, 'down-voting takes away their favourite');
select tests.act_as('viewer');
select lives_ok($$ delete from public.downvotes where user_id = auth.uid() $$, 'you can take back your own down-vote');
reset role;
select is((select count(*)::int from public.downvotes where user_id = '00000000-0000-0000-0000-00000000000c'), 0, 'and it goes');

---------------------------------------------------------------------------------------------------
-- Not on the board, or signed out
select tests.act_as('stranger');
select is((select count(*)::int from public.downvotes), 0, 'a stranger sees no down-votes');
select throws_ok($$ insert into public.downvotes (board_id, node_id) values ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001') $$, '42501', null, 'or adds one');
select tests.signed_out();
select throws_ok($$ select count(*) from public.downvotes $$, '42501', null, 'signed out, there''s no access at all');

select * from finish();
rollback;
