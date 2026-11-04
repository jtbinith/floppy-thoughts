-- Deleting your own account, from your account page. In one go, and only ever your own:
--   your profile, your favourites and your place on every board go;
--   the boards you own go, with everything on them;
--   on boards someone else owns, the boxes and links you added stay (so the team doesn't lose its
--   work), with your name taken off them.
-- (All of that follows from how the tables are linked; this just removes the account itself.)
create function public.delete_my_account() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'Sign in first' using errcode = '42501';
  end if;
  delete from auth.users where id = auth.uid();
end $$;

revoke all on function public.delete_my_account from public, anon;
grant execute on function public.delete_my_account to authenticated;

-- "Edited by" (and "last edited") only change when a box's content does: its text, place or kind.
-- Taking a deleted account's name off its boxes isn't an edit by anyone.
create or replace function private.stamp_updated() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' or (new.number, new.text, new.kind, new.category, new.locked, new.nudge_type, new.x, new.y)
    is distinct from (old.number, old.text, old.kind, old.category, old.locked, old.nudge_type, old.x, old.y) then
    new.updated_at = now();
    new.updated_by = auth.uid();
  end if;
  return new;
end $$;
