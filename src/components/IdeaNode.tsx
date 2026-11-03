import { useEffect, useRef } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { CATEGORY_LABEL, MAX_NODE_TEXT } from '../lib/board'
import type { IdeaFlowNode } from '../lib/flow'
import { useBoardActions } from './boardActions'
import { HeartIcon } from './HeartIcon'
import { LockIcon } from './LockIcon'

// One idea on the board. Deliberately plain text, so the visuals don't steer anyone's thinking.
export function IdeaNode({ id, data, selected }: NodeProps<IdeaFlowNode>) {
  const { editingId, commitEdit, commitAndBranch, cancelEdit, deleteNode, favourite, pick, nudge } = useBoardActions()
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
      if (input && document.activeElement === input) input.select()
      else if (tries++ < 30) frame = requestAnimationFrame(tryFocus)
    }
    frame = requestAnimationFrame(tryFocus)
    return () => cancelAnimationFrame(frame)
  }, [editing])
  const isTheme = data.category === 'theme'
  const label = data.kind === 'spark' ? (isTheme ? 'theme' : 'note') : data.kind === 'nudge' ? data.nudgeType : 'idea'

  return (
    <div
      data-number={data.number}
      className={`idea idea--${data.kind}${data.category ? ` idea--cat-${data.category}` : ''}${editing ? ' idea--editing' : ''}${data.favourite ? ' idea--favourite' : ''}${data.chosen ? ' idea--chosen' : ''}`}
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
        {data.chosen && <span className="idea__chosen-mark">✓ the one</span>}
        {data.favourite && (
          <span className="idea__fav-mark" title="A favourite">
            <HeartIcon size={9} />
          </span>
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
        <button type="button" className="idea__delete nodrag" aria-label={`Delete ${data.number}`} onClick={() => deleteNode(id)}>
          ×
        </button>
      )}
      {selected && !editing && (
        <span className="idea__tools">
          <button
            type="button"
            className={`idea__tool idea__fav nodrag${data.favourite ? ' idea__fav--on' : ''}`}
            aria-label={data.favourite ? `Unfavourite ${data.number}` : `Favourite ${data.number}`}
            aria-pressed={!!data.favourite}
            title="Favourite (F)"
            onClick={() => favourite(id)}
          >
            <HeartIcon filled={!!data.favourite} />
          </button>
          {!isTheme && data.kind !== 'nudge' && (
            <button
              type="button"
              className={`idea__tool nodrag${data.chosen ? ' idea__chosen--on' : ''}`}
              aria-pressed={!!data.chosen}
              title="The idea you're going with: see how you got there"
              onClick={() => pick(id)}
            >
              {data.chosen ? '✓ the one' : 'this is the one'}
            </button>
          )}
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
