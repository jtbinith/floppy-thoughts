import { useState, type ReactNode } from 'react'
import { folderOf, foldersIn, pathTo, type Folders } from '../lib/folders'
import type { BoardSummary } from '../lib/storage'
import { FolderIcon } from './FolderIcon'
import { DRAGGED, TOP, dragData, dragEnded, dragStarted, holdToDrag, type Dragged } from './folderDrag'

// Your folders and boards as a tree, like the files in a code editor: folders open and close,
// boards are one line each. Picking a folder shows its boards as cards beside the tree; picking a
// board opens it. Boards and folders can be dragged onto a folder here too (press and hold on a
// touch screen).

type Props = {
  folders: Folders
  boards: BoardSummary[]
  at: string | null
  openId?: string
  onPick: (folder: string | null) => void
  onOpenBoard: (id: string) => void
  onDrop: (thing: Dragged, into: string | null) => void
}

export function FolderTree({ folders, boards, at, openId, onPick, onOpenBoard, onDrop }: Props) {
  // Folders you've opened or closed. The way down to the folder you're in starts open.
  const [opened, setOpened] = useState<Set<string>>(() => new Set())
  const [closed, setClosed] = useState<Set<string>>(() => new Set())
  const onPath = new Set(pathTo(folders, at).map((f) => f.id))
  const isOpen = (id: string) => opened.has(id) || (onPath.has(id) && !closed.has(id))
  const toggle = (id: string) => {
    const open = isOpen(id)
    const without = (set: Set<string>) => new Set([...set].filter((x) => x !== id))
    setOpened((was) => (open ? without(was) : new Set([...was, id])))
    setClosed((was) => (open ? new Set([...was, id]) : without(was)))
  }
  const byName = (a: BoardSummary, b: BoardSummary) => a.name.localeCompare(b.name, 'en', { numeric: true, sensitivity: 'base' })
  const boardsIn = (folder: string | null) => boards.filter((b) => folderOf(folders, b.id) === folder).sort(byName)

  const level = (folder: string | null, depth: number) => (
    <ul className="tree__level" role="group">
      {foldersIn(folders, folder).map((f) => {
        const open = isOpen(f.id)
        return (
          <li key={f.id}>
            <Row
              drop={f.id}
              depth={depth}
              current={at === f.id}
              thing={{ kind: 'folder', id: f.id }}
              label={f.name}
              onDrop={onDrop}
              toggle={
                <button type="button" className="tree__toggle" aria-label={`${open ? 'Close' : 'Open'} ${f.name}`} aria-expanded={open} onClick={() => toggle(f.id)}>
                  <span aria-hidden="true">{open ? '▾' : '▸'}</span>
                </button>
              }
              onClick={() => onPick(f.id)}
            >
              <FolderIcon size={13} /> {f.name}
            </Row>
            {open && level(f.id, depth + 1)}
          </li>
        )
      })}
      {boardsIn(folder).map((b) => (
        <li key={b.id}>
          <Row depth={depth} current={b.id === openId} thing={{ kind: 'board', id: b.id }} label={b.name} onDrop={onDrop} onClick={() => onOpenBoard(b.id)} board>
            {b.name}
            {b.people && (
              <span className="tree__shared" title={`Shared: ${b.people.length} people`} aria-label={`shared with ${b.people.length - 1} others`}>
                <PeopleIcon />
              </span>
            )}
          </Row>
        </li>
      ))}
    </ul>
  )

  return (
    <nav className="tree" aria-label="Folders and boards">
      <Row drop={TOP} depth={0} current={at === null} label="my boards" onDrop={onDrop} onClick={() => onPick(null)}>
        my boards
      </Row>
      {level(null, 1)}
    </nav>
  )
}

// One line of the tree. Folders (and "my boards") take drops; boards and folders can be dragged.
function Row(props: {
  drop?: string
  depth: number
  current: boolean
  thing?: Dragged
  label: string
  board?: boolean
  toggle?: ReactNode
  onClick: () => void
  onDrop: (thing: Dragged, into: string | null) => void
  children: ReactNode
}) {
  const { drop, depth, current, thing, label, board, toggle, onClick, onDrop, children } = props
  const [over, setOver] = useState(false)
  return (
    <div
      className={`tree__row${current ? ' tree__row--current' : ''}${board ? ' tree__row--board' : ''}${over ? ' drop-over' : ''}`}
      style={{ paddingLeft: `${depth * 0.9 + (toggle || board || !drop ? 0 : 1.4)}rem` }}
      data-drop={drop}
      draggable={!!thing}
      onDragStart={(e) => {
        if (!thing) return
        e.dataTransfer.setData(DRAGGED, JSON.stringify(thing))
        e.dataTransfer.effectAllowed = 'move'
        dragStarted()
      }}
      onDragEnd={dragEnded}
      onDragOver={(e) => {
        if (drop === undefined || !e.dataTransfer.types.includes(DRAGGED)) return
        e.preventDefault()
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        if (drop === undefined) return
        e.preventDefault()
        setOver(false)
        dragEnded()
        const dropped = dragData(e)
        if (dropped && dropped.id !== drop) onDrop(dropped, drop === TOP ? null : drop)
      }}
      onTouchStart={(e) => thing && holdToDrag(e, thing, label, onDrop)}
    >
      {toggle ?? (board ? <span className="tree__spacer" aria-hidden="true" /> : null)}
      <button type="button" className="tree__name" aria-current={current ? (board ? 'true' : 'page') : undefined} onClick={onClick}>
        {children}
      </button>
    </div>
  )
}

// Two little heads: a board shared with other people.
function PeopleIcon() {
  return (
    <svg viewBox="0 0 16 12" width="14" height="11" fill="currentColor" aria-hidden="true">
      <circle cx="5" cy="3.2" r="2.4" />
      <path d="M0.6 11.4c0-2.8 2-4.6 4.4-4.6s4.4 1.8 4.4 4.6z" />
      <circle cx="11.4" cy="3.6" r="2" opacity="0.7" />
      <path d="M8.6 11.4c0.2-2 0.9-3.4 2.8-3.9 2 0.1 3.9 1.6 4 3.9z" opacity="0.7" />
    </svg>
  )
}
