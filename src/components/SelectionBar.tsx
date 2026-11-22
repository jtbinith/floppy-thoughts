import { useStore } from '@xyflow/react'
import { isMine, type Board } from '../lib/board'
import { findNode } from '../lib/boardOps'
import { useBoardActions } from './boardActions'
import { HeartIcon } from './HeartIcon'

// On a phone: when one box is selected, everything you can do with it, in a bar docked along the
// bottom of the board. Always on screen and never over another box, unlike buttons on the box.
// (Desktop keeps the small buttons on the box itself, plus the keys.)
export function SelectionBar({ board }: { board: Board }) {
  const actions = useBoardActions()
  // Only re-draws when which box is selected changes.
  const selectedId = useStore((s) => {
    const ids = [...s.nodeLookup.values()].filter((n) => n.selected).map((n) => n.id)
    return ids.length === 1 ? ids[0] : null
  })
  const node = selectedId ? findNode(board, selectedId) : undefined
  if (!node || actions.editingId === node.id) return null

  const mine = isMine(node)
  const editable = node.kind === 'user' || node.category === 'theme'
  const linking = actions.linkingFrom === node.id
  const n = node.number
  return (
    <div className="selection-bar" role="toolbar" aria-label={`Box ${n}`}>
      <button type="button" className={`selection-bar__button${mine ? ' selection-bar__button--on' : ''}`} aria-pressed={mine} aria-label={mine ? `Unfavourite ${n}` : `Favourite ${n}`} onClick={() => actions.favourite(node.id)}>
        <HeartIcon filled={mine} size={14} />
      </button>
      {node.kind !== 'nudge' && (
        <button type="button" className="selection-bar__button" aria-label={`Nudge ${n}`} onClick={() => actions.nudge(node.id)}>
          nudge
        </button>
      )}
      {editable && (
        <button type="button" className="selection-bar__button" aria-label={`Edit ${n}`} onClick={() => actions.startEdit(node.id)}>
          edit
        </button>
      )}
      <button
        type="button"
        className={`selection-bar__button${linking ? ' selection-bar__button--on' : ''}`}
        aria-pressed={linking}
        aria-label={`Link ${n} to another box`}
        onClick={() => (linking ? actions.cancelLink() : actions.startLink(node.id))}
      >
        link
      </button>
      <button type="button" className="selection-bar__button" aria-label={`Add an idea linked to ${n}`} onClick={() => actions.branch(node.id)}>
        + next
      </button>
      <button type="button" className="selection-bar__button selection-bar__delete" aria-label={`Delete ${n}`} onClick={() => actions.deleteNode(node.id)}>
        ×
      </button>
    </div>
  )
}
