-- Live updates and who's here: each open board talks on its own private channel, "board:<id>".
-- Only people on the board can listen or send there (Supabase Realtime checks these rules).

-- Whether you're on the board a channel is for. Anything that isn't a board channel is no.
create function private.on_board_channel(topic text) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare
  board uuid;
begin
  if topic not like 'board:%' then
    return false;
  end if;
  begin
    board := substring(topic from 7)::uuid;
  exception when invalid_text_representation then
    return false;
  end;
  return private.role_on(board) is not null;
end $$;
revoke all on function private.on_board_channel from public;
grant execute on function private.on_board_channel to authenticated;

-- Supabase's own Realtime table, where these rules live (it's there on Supabase, not in the
-- plain Postgres the tests use).
do $$
begin
  if to_regclass('realtime.messages') is not null then
    execute $p$
      create policy "people on a board hear its changes" on realtime.messages
        for select to authenticated using (private.on_board_channel(realtime.topic()))
    $p$;
    execute $p$
      create policy "people on a board send changes and say they're here" on realtime.messages
        for insert to authenticated with check (private.on_board_channel(realtime.topic()))
    $p$;
  end if;
end $$;
