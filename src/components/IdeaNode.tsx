import { useEffect, useRef } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { MAX_NODE_TEXT } from '../lib/board'
import type { IdeaFlowNode } from '../lib/flow'
import { useBoardActions } from './boardActions'

// One idea on the board. Deliberately plain text, so the visuals don't steer anyone's thinking.
export function IdeaNode({ id, data, selected }: NodeProps<IdeaFlowNode>) {
  const { editingId, commitEdit, cancelEdit, deleteNode } = useBoardActions()
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
  const isOwn = data.kind === 'user'
  const label = data.kind === 'spark' ? (data.locked ? 'theme' : 'spark') : data.kind === 'nudge' ? data.nudgeType : 'idea'

  return (
    <div className={`idea idea--${data.kind}${editing ? ' idea--editing' : ''}`}>
      {/* Drag from either dot to another node to link them. */}
      <Handle type="target" position={Position.Top} className="idea__handle" />
      <span className="idea__meta">
        <span className="idea__label">
          {data.locked && <span aria-label="locked">🔒 </span>}
          {label}
        </span>
        <span className="idea__id">{id}</span>
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

      {isOwn && selected && !editing && (
        <button type="button" className="idea__delete nodrag" aria-label={`Delete ${id}`} onClick={() => deleteNode(id)}>
          ×
        </button>
      )}
      <Handle type="source" position={Position.Bottom} className="idea__handle" />
    </div>
  )
}
