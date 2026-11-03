import { useState, type RefObject } from 'react'
import { useReactFlow } from '@xyflow/react'
import { MAX_BOARD_NAME, shown, type Board } from '../../lib/board'
import { addLinkedIdea, addNote, addNudge, addTheme, addUserNode, chainAround, chooseIdea, cleanText, deleteNodes, editUserNode, findNode, themes, toggleFavourite, touch } from '../../lib/boardOps'
import { favouritesBoard } from '../../lib/favouritesBoard'
import { pickNudge, type NudgeChoice } from '../../lib/nudges/pickNudge'
import { BOX, PLACE, centreOfBox } from '../../lib/placement'
import type { Spark } from '../../lib/sparks/deal'
import { rememberSeen } from '../../lib/sparks/seen'

type Spot = { x: number; y: number }

// Text a brand-new idea starts with, selected so typing replaces it.
export const NEW_IDEA = 'new idea'

// The board without the given links (e.g. links selected along with nodes for deleting).
function withoutLinks(board: Board, links: [string, string][]): Board {
  if (links.length === 0) return board
  const gone = (l: { from: string; to: string }) => links.some(([a, b]) => (l.from === a && l.to === b) || (l.from === b && l.to === a))
  return { ...board, links: board.links.filter((l) => !gone(l)) }
}

// Every change to the board from the screen, the keyboard and the terminal: adding and editing
// ideas, branching, nudges, notes from the machine, themes, favourites, picking the one,
// renaming, and deleting (which asks first if it would break a chain). Each goes through
// `commit`, so it can be undone.
export function useBoardEdits({
  board,
  latest,
  commit,
  onChange,
  view: { spotNear, centreOf, reveal, noteSpot },
  say,
  edit,
  onPicked,
  onOpenNew,
}: {
  board: Board
  latest: RefObject<Board>
  commit: (previous: Board, next: Board) => void
  // Saving without a new undo step (typing into a brand-new idea is part of adding it).
  onChange: (board: Board) => void
  view: { spotNear: (on: Board, target: Spot) => Spot; centreOf: (on: Board) => Spot; reveal: (at: Spot) => void; noteSpot: () => Spot }
  // A short message by the board's title.
  say: (message: string) => void
  // Start typing in a box (or stop, with null).
  edit: (id: string | null) => void
  // You picked the idea you're going with (the summary opens).
  onPicked: () => void
  // Open a board made here (a favourites board).
  onOpenNew: (board: Board) => void
}) {
  const { getNodes } = useReactFlow()
  // Deleting from the middle of a chain asks first whether to keep it connected.
  const [pendingDelete, setPendingDelete] = useState<{
    ids: string[]
    links: [string, string][]
    chains: { id: string; around: [string, string] }[]
  } | null>(null)

  function addAndEdit(at: { x: number; y: number }) {
    const result = addUserNode(board, NEW_IDEA, at)
    if (!result.ok) {
      say(result.error)
      return
    }
    commit(board, result.board)
    edit(result.node?.id ?? null)
  }

  // Tab: add a new idea linked to `fromId`, just below it, and start typing in it.
  function branchFrom(from: Board, fromId: string) {
    const parent = findNode(from, fromId)
    if (!parent) return
    const at = spotNear(from, { x: parent.x + PLACE.branch.x, y: parent.y + PLACE.branch.y })
    const result = addLinkedIdea(from, fromId, NEW_IDEA, at)
    if (!result.ok) {
      say(result.error)
      return
    }
    commit(from, result.board)
    edit(result.node?.id ?? null)
    reveal(at)
  }

  // N key, the device button, or `nudge <id>` in the terminal. Returns what happened, for the terminal.
  async function requestNudge(targetId: string, type?: NudgeChoice): Promise<{ text: string; error?: boolean }> {
    const nudge = await pickNudge(latest.current, targetId, { type })
    const current = latest.current
    const target = findNode(current, targetId)
    if (!target) return { text: `Nothing numbered ${shown(targetId)}`, error: true }
    if (!nudge) {
      const message = `${shown(targetId)} is a nudge already. Nudge the idea or note it's about instead.`
      say(message)
      return { text: message, error: true }
    }
    const at = spotNear(current, { x: target.x + PLACE.nudge.x, y: target.y + PLACE.nudge.y })
    const result = addNudge(current, targetId, nudge, at)
    if (!result.ok) {
      say(result.error)
      return { text: result.error, error: true }
    }
    commit(current, result.board)
    reveal(at)
    return { text: `${shown(result.node?.id)} (${nudge.type}): ${nudge.text}` }
  }

  function nudgeSelected() {
    const selected = getNodes().filter((n) => n.selected)
    if (selected.length !== 1) {
      say('Select one idea first, then press N (or its nudge button) for a nudge.')
      return
    }
    void requestNudge(selected[0].id)
  }

  function placeNote(note: Spark, spot?: { x: number; y: number }): { text: string; error?: boolean } {
    const current = latest.current
    const at = spot ?? noteSpot()
    const result = addNote(current, note, at)
    if (!result.ok) {
      say(result.error)
      return { text: result.error, error: true }
    }
    if (note.category !== 'theme') rememberSeen([note.text])
    commit(current, result.board)
    reveal(at)
    return { text: `${shown(result.node?.id)}: ${note.text}` }
  }

  // Every delete comes through here. If something sits in the middle of a chain, ask first.
  // Returns false when it's waiting for that answer.
  function requestDelete(ids: string[], links: [string, string][] = []): boolean {
    const chains = ids
      .map((id) => ({ id, around: chainAround(withoutLinks(board, links), id) }))
      .filter((c): c is { id: string; around: [string, string] } => !!c.around)
    if (chains.length === 0) {
      applyDelete(ids, links, false)
      return true
    }
    setPendingDelete({ ids, links, chains })
    return false
  }

  function applyDelete(ids: string[], links: [string, string][], reconnect: boolean) {
    const base = withoutLinks(board, links)
    const next = ids.length ? deleteNodes(base, ids, { reconnect }) : base === board ? board : touch(base, new Date())
    if (next !== board) commit(board, next)
  }

  function finishDelete(reconnect: boolean) {
    if (!pendingDelete) return
    applyDelete(pendingDelete.ids, pendingDelete.links, reconnect)
    setPendingDelete(null)
  }

  function pick(id: string) {
    const result = chooseIdea(board, id)
    if (!result.ok) return
    commit(board, result.board)
    if (result.node?.chosen) onPicked()
  }

  function makeFavouritesBoard(): string {
    const made = favouritesBoard(board)
    if (!made) return 'no favourites on this board yet. try /fav <id>'
    onOpenNew(made)
    return `made ${made.name}`
  }

  // Adds one or more themes. The first on an empty board goes in the middle; each one after sits
  // beside the last theme. All in one go, so one undo takes them all back.
  function addThemes(texts: string[]) {
    let next = board
    for (const text of texts) {
      const last = themes(next).at(-1)
      const at = last
        ? spotNear(next, { x: centreOfBox(last).x + BOX.width + 40, y: centreOfBox(last).y })
        : next.nodes.length
          ? centreOf(next)
          : { x: 0, y: 0 }
      const result = addTheme(next, text, at)
      if (result.ok) next = result.board
    }
    if (next !== board) commit(board, next)
  }

  function favourite(id: string) {
    const result = toggleFavourite(board, id)
    if (result.ok) commit(board, result.board)
  }

  function rename(name: string) {
    const clean = cleanText(name).slice(0, MAX_BOARD_NAME)
    if (clean && clean !== board.name) commit(board, touch({ ...board, name: clean }, new Date()))
  }

  function saveEdit(id: string, text: string): Board {
    const node = findNode(board, id)
    if (node?.text === text.trim()) return board
    const result = editUserNode(board, id, text)
    if (!result.ok) return board
    // Typing into a brand-new idea counts as part of adding it, so one undo removes both.
    if (node?.text === NEW_IDEA) onChange(result.board)
    else commit(board, result.board)
    return result.board
  }

  return {
    addAndEdit,
    branchFrom,
    requestNudge,
    nudgeSelected,
    placeNote,
    requestDelete,
    pendingDelete,
    finishDelete,
    cancelDelete: () => setPendingDelete(null),
    pick,
    makeFavouritesBoard,
    addThemes,
    favourite,
    rename,
    saveEdit,
  }
}
