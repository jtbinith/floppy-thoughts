-- Sharing: admins, invite links you can copy again, who edited each box, and "last edited" on
-- any change.

---------------------------------------------------------------------------------------------------
-- Admins: they manage sharing and people like the owner, but can't delete the board or change
-- the owner. A board can have several.

alter table public.board_members drop constraint board_members_role_check;
alter table public.board_members add constraint board_members_role_check check (role in ('owner', 'admin', 'editor', 'viewer'));

create or replace function private.can_edit(board uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(private.role_on(board) in ('owner', 'admin', 'editor'), false)
$$;

-- Owners and admins: share the board, change roles, remove people.
create function private.can_manage(board uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(private.role_on(board) in ('owner', 'admin'), false)
$$;
revoke all on function private.can_manage from public;
grant execute on function private.can_manage to authenticated;

drop policy "owners change roles" on public.board_members;
create policy "owners and admins change roles" on public.board_members
  for update to authenticated using (private.can_manage(board_id)) with check (private.can_manage(board_id));

drop policy "owners remove people, anyone leaves" on public.board_members;
create policy "owners and admins remove people, anyone leaves" on public.board_members
  for delete to authenticated
  using (role <> 'owner' and (user_id = auth.uid() or private.can_manage(board_id)));

---------------------------------------------------------------------------------------------------
-- Invite links you can copy again. The link is kept as it is (not scrambled), readable only by the
-- board's owner and admins through invite_link below; it can be reset or turned off any time.

delete from public.board_invites;
alter table public.board_invites drop column token_hash;
alter table public.board_invites add column token text not null unique;

-- The board's live invite link, or null if there isn't one (owners and admins).
create function public.invite_link(board uuid) returns text
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.can_manage(board) then
    raise exception 'Only the owner or an admin can see this' using errcode = '42501';
  end if;
  return (select token from public.board_invites where board_id = board);
end $$;

-- A new link for the board, replacing any old one so it stops working (owners and admins).
create or replace function public.make_invite(board uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare
  secret text := encode(extensions.gen_random_bytes(24), 'hex');
begin
  if not private.can_manage(board) then
    raise exception 'Only the owner or an admin can share this board' using errcode = '42501';
  end if;
  insert into public.board_invites (board_id, token, created_by) values (board, secret, auth.uid())
  on conflict (board_id) do update set token = excluded.token, created_by = excluded.created_by, created_at = now();
  return secret;
end $$;

create or replace function public.stop_invite(board uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.can_manage(board) then
    raise exception 'Only the owner or an admin can stop sharing this board' using errcode = '42501';
  end if;
  delete from public.board_invites where board_id = board;
end $$;

create or replace function public.join_board(secret text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  board uuid;
begin
  if auth.uid() is null then
    raise exception 'Sign in to join a board' using errcode = '42501';
  end if;
  select board_id into board from public.board_invites where token = secret;
  if board is null then
    return null;
  end if;
  insert into public.board_members (board_id, user_id, role) values (board, auth.uid(), 'editor')
  on conflict do nothing;
  return board;
end $$;

revoke all on function public.invite_link from public, anon;
grant execute on function public.invite_link to authenticated;

---------------------------------------------------------------------------------------------------
-- Who last edited each box, set by the database (whoever's signed in), so it can't be faked.

alter table public.nodes add column updated_by uuid default auth.uid() references auth.users on delete set null;

create or replace function private.stamp_updated() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  new.updated_by = auth.uid();
  return new;
end $$;
drop trigger stamp_updated on public.nodes;
create trigger stamp_updated before insert or update on public.nodes
  for each row execute function private.stamp_updated();

---------------------------------------------------------------------------------------------------
-- "Last edited": any change to a board itself (renaming it, say) counts, like changes to its
-- boxes. The one exception is keep_edited, for a board uploaded with the date it really had.

create function private.stamp_board() returns trigger
language plpgsql set search_path = '' as $$
begin
  if coalesce(current_setting('floppy.keep_date', true), '') <> 'on' then
    new.updated_at = now();
  end if;
  return new;
end $$;
create trigger stamp_board before update on public.boards
  for each row execute function private.stamp_board();

-- A board uploaded from the browser on first sign-in keeps its "last edited" date. Owner only,
-- and never later than now.
create function public.keep_edited(board uuid, edited timestamptz) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if private.role_on(board) is distinct from 'owner' then
    raise exception 'Only the owner can do that' using errcode = '42501';
  end if;
  perform set_config('floppy.keep_date', 'on', true);
  update public.boards set updated_at = least(edited, now()) where id = board;
  perform set_config('floppy.keep_date', '', true);
end $$;

revoke all on function public.keep_edited from public, anon;
grant execute on function public.keep_edited to authenticated;
