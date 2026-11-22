import { useState } from 'react'
import { facesFor, type Person } from '../lib/reactors'

// The faces by a count on a shared board: the profile pictures of who favourited or down-voted
// a box (their initials if they have no picture), a few and then "+3", so a busy box stays tidy.
// Hover for everyone's names, or tap to show them under the faces (tap again to hide).
export function Reactors({ ids, personOf, what }: { ids: string[]; personOf: (id: string) => Person | undefined; what: string }) {
  const [open, setOpen] = useState(false)
  const { shown, extra, names } = facesFor(ids, personOf)
  return (
    <span className="reactors">
      <button
        type="button"
        className="reactors__faces nodrag"
        title={`${what} by ${names}`}
        aria-label={`${what} by ${names}`}
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation()
          setOpen(!open)
        }}
      >
        {shown.map((p) =>
          p.avatarUrl ? <img key={p.id} src={p.avatarUrl} alt="" width={16} height={16} /> : <span key={p.id}>{p.initials}</span>,
        )}
        {extra > 0 && <small>+{extra}</small>}
      </button>
      {open && <span className="reactors__names">{names}</span>}
    </span>
  )
}

