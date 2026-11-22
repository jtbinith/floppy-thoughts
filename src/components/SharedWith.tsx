import type { BoardSummary } from '../lib/storage'
import { facesFor } from '../lib/reactors'

// On a shared board's card: the faces of who's on it (a few, then +N) and who shared it.
export function SharedWith({ people }: { people: NonNullable<BoardSummary['people']> }) {
  const byId = new Map(people.map((p) => [p.id, p]))
  const { shown, extra, names } = facesFor(
    people.map((p) => p.id),
    (id) => byId.get(id),
    4,
  )
  const owner = people.find((p) => p.owner)
  const by = !owner || owner.name === 'you' ? 'shared by you' : `shared by ${owner.name}`
  return (
    <span className="shared-with" title={`On this board: ${names}`}>
      <span className="shared-with__faces" aria-label={`On this board: ${names}`}>
        {shown.map((p) => (p.avatarUrl ? <img key={p.id} src={p.avatarUrl} alt="" width={18} height={18} /> : <span key={p.id}>{p.initials}</span>))}
        {extra > 0 && <small>+{extra}</small>}
      </span>
      <small className="shared-with__by">{by}</small>
    </span>
  )
}
