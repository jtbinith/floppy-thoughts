import { useEffect, useRef } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { CATEGORY_LABEL, MAX_NODE_TEXT, isDownvoted, isFavourite, isMine, isMyDownvote } from '../lib/board'
import type { IdeaFlowNode } from '../lib/flow'
import { useBoardActions } from './boardActions'
import { BinIcon } from './BinIcon'
import { DownvoteIcon } from './DownvoteIcon'
import { HeartIcon } from './HeartIcon'
import { LockIcon } from './LockIcon'
import { useTouch } from '../lib/usePhone'

// One idea on the board. Deliberately plain text, so the visuals don't steer anyone's thinking.
export function IdeaNode({ id, data, selected }: NodeProps<IdeaFlowNode>) {
  const { editingId, commitEdit, commitAndBranch, cancelEdit, deleteNode, favourite, downvote, nudge, whoIs, linkingFrom, shared } = useBoardActions()
  // On a touch screen the selected box's actions are in the bar along the bottom of the board
  // instead (see SelectionBar); here it only keeps the box in view above the on-screen keyboard.
  const touch = useTouch()
  const editing = editingId === id
  // Escape unmounts the textarea, which fires blur; this stops that blur from saving.
  const finished = useRef(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // React Flow hides brand-new nodes until it has measured them, and hidden elements
  // can't take focus, so keep trying for a few frames until the editor is visible.
  useEffect(() => {
    if (!editing) return
    finished.current = false
    let frame = 0
    let tries = 0
    const tryFocus = () => {
      const input = inputRef.current
      input?.focus()
      if (input && document.activeElement === input) {
        input.select()
        // The on-screen keyboard comes up over the bottom of the screen: keep the box in view.
        if (touch) setTimeout(() => input.scrollIntoView({ block: 'center', behavior: 'smooth' }), 300)
      } else if (tries++ < 30) frame = requestAnimationFrame(tryFocus)
    }
    frame = requestAnimationFrame(tryFocus)
    return () => cancelAnimationFrame(frame)
  }, [editing, touch])
  const isTheme = data.category === 'theme'
  const isFav = isFavourite(data)
  const mine = isMine(data)
  const myDown = isMyDownvote(data)
  const favs = data.favouritedBy?.length ?? 0
  const downs = data.downvotedBy?.length ?? 0
    const label = data.kind === 'spark' ? (isTheme ? 'theme' : 'note') : data.kind === 'nudge' ? data.nudgeType : 'idea'

  return (
    <div
      data-number={data.number}
      title={byWhom(whoIs(data.addedBy), whoIs(data.editedBy))}
      className={`idea idea--${data.kind}${data.category ? ` idea--cat-${data.category}` : ''}${editing ? ' idea--editing' : ''}${isFav ? ' idea--favourite' : ''}${linkingFrom === id ? ' idea--linking' : ''}`}
    >
      {/* Drag from either dot to another node to link them. */}
      <Handle type="target" position={Position.Top} className="idea__handle" />
      <span className="idea__meta">
        <span className="idea__label">
          {data.locked && <LockIcon />} 
          {label}
        </span>
        {data.kind === 'spark' && data.category && (
          <>
            {data.locked && (
              <span className="idea__lock">
                <LockIcon />
              </span>
            )}
            <span className="idea__category">{CATEGORY_LABEL[data.category]}</span>
          </>
        )}
        {/* Shared boards show how many favourited and down-voted it, apart (never one score);
            a board only you have just shows your own heart or down-vote. */}
        {shared ? (
          <>
            {favs > 0 && (
              <span className="idea__fav-mark idea__count" title={`${favs} favourited`} aria-label={`${favs} favourited`}>
                <HeartIcon size={9} /> {favs}
              </span>
            )}
            {downs > 0 && (
              <span className="idea__down-mark idea__count" title={`${downs} down-voted`} aria-label={`${downs} down-voted`}>
                <DownvoteIcon size={9} /> {downs}
              </span>
            )}
          </>
        ) : (
          <>
            {isFav && (
              <span className="idea__fav-mark" title="Favourite">
                <HeartIcon size={9} />
              </span>
            )}
            {isDownvoted(data) && (
              <span className="idea__down-mark" title="Down-voted">
                <DownvoteIcon size={9} />
              </span>
            )}
          </>
        )}
        <span className="idea__id">{data.number}</span>
      </span>

      {editing ? (
        <textarea
          className="idea__input nodrag nopan nowheel"
          aria-label="Edit idea"
          defaultValue={data.text}
          maxLength={MAX_NODE_TEXT}
          rows={2}
          ref={inputRef}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              finished.current = true
              commitEdit(id, e.currentTarget.value)
            } else if (e.key === 'Tab' && !e.shiftKey) {
              // Keep going: save this idea and start a new one linked to it.
              e.preventDefault()
              finished.current = true
              commitAndBranch(id, e.currentTarget.value)
            } else if (e.key === 'Escape') {
              finished.current = true
              cancelEdit()
            }
          }}
          onBlur={(e) => !finished.current && commitEdit(id, e.currentTarget.value)}
        />
      ) : (
        <span className="idea__text">{data.text}</span>
      )}

      {selected && !editing && (
        <button type="button" className="idea__delete nodrag" aria-label={`Delete ${data.number}`} onClick={() => deleteNode(id)} title="Delete (x)">
          <BinIcon size={10} />
        </button>
      )}
      {selected && !editing && (
        <span className="idea__tools">
          <button
            type="button"
            className={`idea__tool idea__fav nodrag${mine ? ' idea__fav--on' : ''}`}
            aria-label={mine ? `Unfavourite ${data.number}` : `Favourite ${data.number}`}
            aria-pressed={mine}
            title="Favourite (F)"
            onClick={() => favourite(id)}
          >
            <HeartIcon filled={mine} />
          </button>
          <button
            type="button"
            className={`idea__tool idea__down nodrag${myDown ? ' idea__down--on' : ''}`}
            aria-label={myDown ? `Take back your down-vote on ${data.number}` : `Down-vote ${data.number}`}
            aria-pressed={myDown}
            title="Not worth building (down-vote)"
            onClick={() => downvote(id)}
          >
            <DownvoteIcon filled={myDown} />
          </button>
          {data.kind !== 'nudge' && (
            <button type="button" className="idea__tool nodrag" aria-label={`Nudge ${data.number}`} title="A word or question to push this further (N)" onClick={() => nudge(id)}>
              nudge
            </button>
          )}
        </span>
      )}
      <Handle type="source" position={Position.Bottom} className="idea__handle" />
    </div>
  )
}

// On a shared board: "added by edie · edited by you". Nothing on a board only you have.
function byWhom(added?: string, edited?: string): string | undefined {
  const parts = [added && `added by ${added}`, edited && edited !== added && `edited by ${edited}`].filter(Boolean)
  return parts.length ? parts.join(' · ') : undefined
}
