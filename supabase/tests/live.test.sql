-- Who may use a board's live channel: only people on the board.
begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'owner@example.com', '{"user_name": "owen"}'),
  ('00000000-0000-0000-0000-00000000000d', 'stranger@example.com', '{"user_name": "stan"}');
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
select is(private.on_board_channel('board:10000000-0000-0000-0000-000000000001'), true, 'people on a board can use its channel');
select is(private.on_board_channel('board:10000000-0000-0000-0000-000000000002'), false, 'not another board''s');
select is(private.on_board_channel('board:not-a-board'), false, 'a made-up channel is a no, not an error');
select is(private.on_board_channel('elsewhere'), false, 'and anything else is a no');
select tests.act_as('00000000-0000-0000-0000-00000000000d');
select is(private.on_board_channel('board:10000000-0000-0000-0000-000000000001'), false, 'a stranger can''t listen in');

select * from finish();
rollback;
