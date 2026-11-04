-- Adds new boxes and saves edited ones in one go. A plain "insert or update" from the app would
-- also try to change each box's id and board, which nobody is allowed to change, so it would be
-- refused. This changes only what can change.
--
-- It runs as whoever calls it (security invoker), so the same rules apply as anywhere else:
-- only owners and editors of the board can add or change its boxes, and a box can't be moved to
-- another board.
create function public.save_nodes(board uuid, rows jsonb) returns void
language sql security invoker set search_path = '' as $$
  insert into public.nodes as n (id, board_id, number, text, kind, category, locked, nudge_type, x, y)
  select r.id, board, r.number, r.text, r.kind, r.category, r.locked, r.nudge_type, r.x, r.y
  from jsonb_to_recordset(rows) as r (
    id uuid, number int, text text, kind text, category text, locked boolean, nudge_type text,
    x double precision, y double precision
  )
  on conflict (id) do update set
    number = excluded.number, text = excluded.text, kind = excluded.kind, category = excluded.category,
    locked = excluded.locked, nudge_type = excluded.nudge_type, x = excluded.x, y = excluded.y
  where n.board_id = excluded.board_id
$$;

revoke all on function public.save_nodes from public, anon;
grant execute on function public.save_nodes to authenticated;
