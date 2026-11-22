-- Down-votes: the opposite of a favourite, for ideas you don't think are worth building. Shaped
-- and guarded exactly like favourites: one per person per box, everyone on a board (viewers too)
-- can down-vote, and only for themselves. Counts are visible to everyone on the board; there is no
-- combined score anywhere.
--
-- An idea is either favourited or down-voted by you, never both: adding one takes away the other,
-- here in the database, so it holds whichever device or app version does the adding.

create table public.downvotes (
  board_id uuid not null,
  node_id uuid not null,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  primary key (node_id, user_id),
  foreign key (node_id, board_id) references public.nodes (id, board_id) on delete cascade
);
create index downvotes_board on public.downvotes (board_id);

create trigger touch_board after insert or delete on public.downvotes
  for each row execute function private.touch_board();

-- Favourite or down-vote, not both. Each takes away the same person's other one on that box.
-- (Only ever their own row, which they're allowed to remove anyway.)
create function private.downvote_replaces_favourite() returns trigger
language plpgsql set search_path = '' as $$
begin
  delete from public.favourites where node_id = new.node_id and user_id = new.user_id;
  return new;
end $$;
create trigger replaces_favourite after insert on public.downvotes
  for each row execute function private.downvote_replaces_favourite();

create function private.favourite_replaces_downvote() returns trigger
language plpgsql set search_path = '' as $$
begin
  delete from public.downvotes where node_id = new.node_id and user_id = new.user_id;
  return new;
end $$;
create trigger replaces_downvote after insert on public.favourites
  for each row execute function private.favourite_replaces_downvote();

alter table public.downvotes enable row level security;
revoke all on public.downvotes from anon, authenticated;
grant select, insert, delete on public.downvotes to authenticated;

create policy "members see down-votes" on public.downvotes
  for select to authenticated using (private.role_on(board_id) is not null);
create policy "members down-vote for themselves" on public.downvotes
  for insert to authenticated with check (user_id = auth.uid() and private.role_on(board_id) is not null);
create policy "members take back their own down-votes" on public.downvotes
  for delete to authenticated using (user_id = auth.uid());
