// Who favourited or down-voted a box on a shared board, ready to show as faces: you first, then
// everyone else in the order they reacted; a few faces and a "+N" for the rest; and everyone's
// names. Anyone no longer on the board shows as "someone".
export type Person = { name: string; avatarUrl: string | null }
export type Face = Person & { id: string; initials: string }

export const FACES = 3

export function facesFor(ids: string[], personOf: (id: string) => Person | undefined, max = FACES) {
  const people: Face[] = ids.map((id) => {
    const p = personOf(id) ?? { name: 'someone', avatarUrl: null }
    return { id, ...p, initials: initials(p.name) }
  })
  people.sort((a, b) => Number(b.name === 'you') - Number(a.name === 'you'))
  return { shown: people.slice(0, max), extra: Math.max(0, people.length - max), names: people.map((p) => p.name).join(', ') }
}

export function initials(name: string): string {
  return (
    name
      .split(/[\s._-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0].toUpperCase())
      .join('') || '?'
  )
}

// Account ids on a board's boxes (who added, edited, favourited or down-voted them) that aren't
// in the list of people yet, as one string so it only changes when that set does. "me" is a
// board kept in this browser, not a person.
export function unknownPeople(
  nodes: { addedBy?: string; editedBy?: string; favouritedBy?: string[]; downvotedBy?: string[] }[],
  known: ReadonlyMap<string, unknown> | null,
  me?: string,
): string {
  const ids = new Set<string>()
  for (const n of nodes)
    for (const id of [n.addedBy, n.editedBy, ...(n.favouritedBy ?? []), ...(n.downvotedBy ?? [])])
      if (id && id !== 'me' && id !== me && !known?.has(id)) ids.add(id)
  return [...ids].sort().join(' ')
}
