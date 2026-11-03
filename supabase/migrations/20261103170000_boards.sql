-- Shared boards: the tables, who can do what (row-level security), and invite links.
-- The design, in plain words, is in docs/database.md. The tests are in supabase/tests.
--
-- Nothing here is open to people who aren't signed in. Tables are only reachable by the roles
-- granted below, and every table has row-level security on, so the database itself refuses
-- anything the rules don't allow, whatever the app sends.

-- Helpers the rules use. They live outside the API, so the app can't call them directly.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

---------------------------------------------------------------------------------------------------
-- Tables

-- Name and picture, from GitHub at sign-in. Shown on boards you share.
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  name text not null default '',
  avatar_url text
);

create table public.boards (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  created_at timestamptz not null default now(),
  -- Changes whenever anything on the board does, for "most recent" sorting.
  updated_at timestamptz not null default now()
);

create table public.board_members (
  board_id uuid not null references public.boards on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  role text not null check (role in ('owner', 'editor', 'viewer')),
  joined_at timestamptz not null default now(),
  primary key (board_id, user_id)
);
create index board_members_user on public.board_members (user_id);

-- The boxes. Ids are made on the device, so two people adding at once never clash.
create table public.nodes (
  id uuid primary key,
  board_id uuid not null references public.boards on delete cascade,
  number int not null check (number > 0),
  text text not null check (char_length(btrim(text)) between 1 and 200),
  kind text not null check (kind in ('spark', 'user', 'nudge')),
  category text check (category in ('theme', 'words', 'objects', 'problems', 'curiosities', 'nature', 'constraints')),
  locked boolean,
  nudge_type text check (nudge_type in ('related', 'opposite', 'described', 'perspective', 'scale', 'senses', 'wildcard', 'push')),
  x double precision not null,
  y double precision not null,
  created_by uuid default auth.uid() references auth.users on delete set null,
  updated_at timestamptz not null default now(),
  unique (board_id, number),
  -- Lets links and favourites check their box is on the same board.
  unique (id, board_id),
  check ((kind = 'spark') = (category is not null)),
  check (kind = 'spark' or locked is null),
  check ((kind = 'nudge') = (nudge_type is not null))
);

-- Links have no direction, so each pair is stored once, smaller id first. Both boxes must be on
-- the board the link says.
create table public.links (
  board_id uuid not null references public.boards on delete cascade,
  node_a uuid not null,
  node_b uuid not null,
  created_by uuid default auth.uid() references auth.users on delete set null,
  primary key (node_a, node_b),
  check (node_a < node_b),
  foreign key (node_a, board_id) references public.nodes (id, board_id) on delete cascade,
  foreign key (node_b, board_id) references public.nodes (id, board_id) on delete cascade
);
create index links_board on public.links (board_id);

-- One favourite per person per box.
create table public.favourites (
  board_id uuid not null,
  node_id uuid not null,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  primary key (node_id, user_id),
  foreign key (node_id, board_id) references public.nodes (id, board_id) on delete cascade
);
create index favourites_board on public.favourites (board_id);

-- One live invite link per board. Only a hash of the secret is kept, never the secret itself, so
-- the links couldn't be used even if the database were read by someone else.
create table public.board_invites (
  board_id uuid primary key references public.boards on delete cascade,
  token_hash text not null unique,
  created_by uuid default auth.uid() references auth.users on delete set null,
  created_at timestamptz not null default now()
);

---------------------------------------------------------------------------------------------------
-- Who is who

-- Your role on a board, or null if you're not on it.
create function private.role_on(board uuid) returns text
language sql stable security definer set search_path = '' as $$
  select role from public.board_members where board_id = board and user_id = auth.uid()
$$;

create function private.can_edit(board uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(private.role_on(board) in ('owner', 'editor'), false)
$$;

-- Whether you and someone else are on a board together (so you can see their name).
create function private.shares_board(other uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.board_members mine join public.board_members theirs using (board_id)
    where mine.user_id = auth.uid() and theirs.user_id = other
  )
$$;

revoke all on all functions in schema private from public;
grant execute on all functions in schema private to authenticated;

---------------------------------------------------------------------------------------------------
-- Keeping things right without trusting the app

-- A profile for each new account, from what GitHub sent; refreshed at each sign-in.
create function private.sync_profile() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'user_name', new.raw_user_meta_data ->> 'name', ''),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do update set name = excluded.name, avatar_url = excluded.avatar_url;
  return new;
end $$;
create trigger sync_profile after insert or update of raw_user_meta_data on auth.users
  for each row execute function private.sync_profile();

-- Whoever makes a board owns it and is its first member.
create function private.add_owner() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.board_members (board_id, user_id, role) values (new.id, new.owner_id, 'owner');
  return new;
end $$;
create trigger add_owner after insert on public.boards
  for each row execute function private.add_owner();

-- Anything changing on a board moves its updated_at on.
create function private.touch_board() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.boards set updated_at = now()
  where id = coalesce(new.board_id, old.board_id);
  return null;
end $$;
create trigger touch_board after insert or update or delete on public.nodes
  for each row execute function private.touch_board();
create trigger touch_board after insert or delete on public.links
  for each row execute function private.touch_board();
create trigger touch_board after insert or delete on public.favourites
  for each row execute function private.touch_board();

create function private.stamp_updated() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end $$;
create trigger stamp_updated before update on public.nodes
  for each row execute function private.stamp_updated();

-- At most 1,000 boxes on a board, as in the app.
create function private.limit_nodes() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.nodes where board_id = new.board_id) >= 1000 then
    raise exception 'A board can have at most 1000 boxes';
  end if;
  return new;
end $$;
create trigger limit_nodes before insert on public.nodes
  for each row execute function private.limit_nodes();

-- Members can't promote themselves, and a board always keeps exactly one owner.
create function private.guard_roles() returns trigger
language plpgsql set search_path = '' as $$
begin
  if old.role = 'owner' or new.role = 'owner' then
    raise exception 'The owner stays the owner';
  end if;
  return new;
end $$;
create trigger guard_roles before update on public.board_members
  for each row execute function private.guard_roles();

---------------------------------------------------------------------------------------------------
-- Who can do what

alter table public.profiles enable row level security;
alter table public.boards enable row level security;
alter table public.board_members enable row level security;
alter table public.nodes enable row level security;
alter table public.links enable row level security;
alter table public.favourites enable row level security;
alter table public.board_invites enable row level security;

-- Signed-out visitors get nothing; signed-in people only what's granted here, and only the rows
-- the rules below allow. Invites have no grants at all: only the functions further down use them.
revoke all on all tables in schema public from anon, authenticated;
grant select on public.profiles to authenticated;
grant select, insert, delete on public.boards to authenticated;
grant update (name) on public.boards to authenticated;
grant select, delete on public.board_members to authenticated;
grant update (role) on public.board_members to authenticated;
grant select, insert, delete on public.nodes to authenticated;
grant update (number, text, kind, category, locked, nudge_type, x, y) on public.nodes to authenticated;
grant select, insert, delete on public.links to authenticated;
grant select, insert, delete on public.favourites to authenticated;

create policy "see yourself and people you share a board with" on public.profiles
  for select to authenticated using (id = auth.uid() or private.shares_board(id));

-- (The owner check is for the moment a board is made, before its owner is added as a member.)
create policy "members see the board" on public.boards
  for select to authenticated using (owner_id = auth.uid() or private.role_on(id) is not null);
create policy "anyone signed in makes their own boards" on public.boards
  for insert to authenticated with check (owner_id = auth.uid());
create policy "owners and editors rename" on public.boards
  for update to authenticated using (private.can_edit(id)) with check (private.can_edit(id));
create policy "owners delete" on public.boards
  for delete to authenticated using (private.role_on(id) = 'owner');

create policy "members see who else is on the board" on public.board_members
  for select to authenticated using (private.role_on(board_id) is not null);
create policy "owners change roles" on public.board_members
  for update to authenticated using (private.role_on(board_id) = 'owner') with check (private.role_on(board_id) = 'owner');
-- Owners remove people; anyone can leave. The owner can't leave their own board (they delete it).
create policy "owners remove people, anyone leaves" on public.board_members
  for delete to authenticated
  using (role <> 'owner' and (user_id = auth.uid() or private.role_on(board_id) = 'owner'));

create policy "members see the boxes" on public.nodes
  for select to authenticated using (private.role_on(board_id) is not null);
create policy "owners and editors add boxes" on public.nodes
  for insert to authenticated with check (private.can_edit(board_id) and created_by = auth.uid());
create policy "owners and editors change boxes" on public.nodes
  for update to authenticated using (private.can_edit(board_id)) with check (private.can_edit(board_id));
create policy "owners and editors delete boxes" on public.nodes
  for delete to authenticated using (private.can_edit(board_id));

create policy "members see the links" on public.links
  for select to authenticated using (private.role_on(board_id) is not null);
create policy "owners and editors link" on public.links
  for insert to authenticated with check (private.can_edit(board_id) and created_by = auth.uid());
create policy "owners and editors unlink" on public.links
  for delete to authenticated using (private.can_edit(board_id));

-- Everyone on a board, viewers too, can favourite; only their own.
create policy "members see favourites" on public.favourites
  for select to authenticated using (private.role_on(board_id) is not null);
create policy "members favourite for themselves" on public.favourites
  for insert to authenticated with check (user_id = auth.uid() and private.role_on(board_id) is not null);
create policy "members unfavourite their own" on public.favourites
  for delete to authenticated using (user_id = auth.uid());

---------------------------------------------------------------------------------------------------
-- Invite links

-- Makes a new invite link for a board (the owner only), replacing any old one so it stops working.
-- Returns the secret for the link. Only its hash is stored, so it can't be shown again.
create function public.make_invite(board uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare
  secret text := encode(extensions.gen_random_bytes(24), 'hex');
begin
  if private.role_on(board) is distinct from 'owner' then
    raise exception 'Only the owner can share this board' using errcode = '42501';
  end if;
  insert into public.board_invites (board_id, token_hash, created_by)
  values (board, encode(sha256(convert_to(secret, 'UTF8')), 'hex'), auth.uid())
  on conflict (board_id) do update
    set token_hash = excluded.token_hash, created_by = excluded.created_by, created_at = now();
  return secret;
end $$;

-- Turns a board's invite link off (the owner only).
create function public.stop_invite(board uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if private.role_on(board) is distinct from 'owner' then
    raise exception 'Only the owner can stop sharing this board' using errcode = '42501';
  end if;
  delete from public.board_invites where board_id = board;
end $$;

-- Joins the board an invite link is for, as an editor. Returns the board's id, or null if the
-- link is wrong or was turned off. Someone already on the board keeps the role they have.
create function public.join_board(secret text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  board uuid;
begin
  if auth.uid() is null then
    raise exception 'Sign in to join a board' using errcode = '42501';
  end if;
  select board_id into board from public.board_invites
  where token_hash = encode(sha256(convert_to(secret, 'UTF8')), 'hex');
  if board is null then
    return null;
  end if;
  insert into public.board_members (board_id, user_id, role) values (board, auth.uid(), 'editor')
  on conflict do nothing;
  return board;
end $$;

revoke all on function public.make_invite, public.stop_invite, public.join_board from public, anon;
grant execute on function public.make_invite, public.stop_invite, public.join_board to authenticated;
