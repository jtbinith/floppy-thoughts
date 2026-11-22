-- Folders: your own way of tidying your boards page. Folders can hold boards and other folders.
-- They're personal: nobody else sees them, even on a board you share. Each person files a
-- shared board wherever they like (or nowhere), so where a board sits is kept per person too.

create table public.folders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  -- The folder it's in, or none for the top of the boards page. Always one of your own (the
  -- foreign key includes you). Deleting a folder deletes the folders inside it; the app moves
  -- them out first when you choose to keep what's inside.
  parent_id uuid,
  created_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (parent_id, user_id) references public.folders (id, user_id) on delete cascade,
  check (parent_id is distinct from id)
);
create index folders_user on public.folders (user_id);

-- Which of your folders each board is in. A board in no folder has no row.
create table public.board_folders (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  board_id uuid not null references public.boards on delete cascade,
  folder_id uuid not null,
  primary key (user_id, board_id),
  foreign key (folder_id, user_id) references public.folders (id, user_id) on delete cascade
);
create index board_folders_folder on public.board_folders (folder_id);

-- A folder can't end up inside itself, however deep: walking up from its new place must never
-- reach it. (Also keeps folders from going absurdly deep.)
create function private.no_folder_loops() returns trigger
language plpgsql set search_path = '' as $$
declare
  at uuid := new.parent_id;
  depth int := 0;
begin
  while at is not null loop
    if at = new.id then
      raise exception 'a folder can''t go inside itself' using errcode = '23514';
    end if;
    depth := depth + 1;
    if depth > 50 then
      raise exception 'folders can''t go that deep' using errcode = '23514';
    end if;
    select f.parent_id into at from public.folders f where f.id = at;
  end loop;
  return new;
end $$;
create trigger no_loops before insert or update of parent_id on public.folders
  for each row execute function private.no_folder_loops();

-- Leaving a board (or being removed from it) takes it out of your folders.
create function private.unfile_left_board() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.board_folders where board_id = old.board_id and user_id = old.user_id;
  return old;
end $$;
create trigger unfile after delete on public.board_members
  for each row execute function private.unfile_left_board();

alter table public.folders enable row level security;
alter table public.board_folders enable row level security;
revoke all on public.folders, public.board_folders from anon, authenticated;
grant select, insert, delete on public.folders to authenticated;
grant update (name, parent_id) on public.folders to authenticated;
grant select, insert, delete on public.board_folders to authenticated;
grant update (folder_id) on public.board_folders to authenticated;

create policy "your own folders" on public.folders
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "see where you filed your boards" on public.board_folders
  for select to authenticated using (user_id = auth.uid());
-- Only boards you're on.
create policy "file boards you're on" on public.board_folders
  for insert to authenticated with check (user_id = auth.uid() and private.role_on(board_id) is not null);
create policy "move boards you're on" on public.board_folders
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid() and private.role_on(board_id) is not null);
create policy "unfile your boards" on public.board_folders
  for delete to authenticated using (user_id = auth.uid());
