import { describe, expect, it } from 'vitest'
import { facesFor, initials, unknownPeople, type Person } from './reactors'

const people = new Map<string, Person>([
  ['a', { name: 'edie', avatarUrl: 'https://example.com/e.png' }],
  ['b', { name: 'sam lee', avatarUrl: null }],
  ['c', { name: 'you', avatarUrl: null }],
  ['d', { name: 'kai', avatarUrl: null }],
  ['e', { name: 'mo_ali', avatarUrl: null }],
])
const personOf = (id: string) => people.get(id)

describe('facesFor', () => {
  it('shows a few faces, then +N for the rest', () => {
    const f = facesFor(['a', 'b', 'd', 'e'], personOf)
    expect(f.shown.map((p) => p.name)).toEqual(['edie', 'sam lee', 'kai'])
    expect(f.extra).toBe(1)
    expect(f.names).toBe('edie, sam lee, kai, mo_ali')
  })

  it('puts you first', () => {
    expect(facesFor(['a', 'b', 'c'], personOf).shown.map((p) => p.name)).toEqual(['you', 'edie', 'sam lee'])
  })

  it('keeps pictures, and has initials for anyone without one', () => {
    const [e, s] = facesFor(['a', 'b'], personOf).shown
    expect(e.avatarUrl).toBe('https://example.com/e.png')
    expect(s).toMatchObject({ avatarUrl: null, initials: 'SL' })
  })

  it('shows someone no longer on the board as "someone"', () => {
    expect(facesFor(['gone'], personOf)).toMatchObject({ names: 'someone', extra: 0 })
  })
})

describe('initials', () => {
  it('takes the first letters of up to two words', () => {
    expect(initials('edie')).toBe('E')
    expect(initials('mo_ali')).toBe('MA')
    expect(initials('ana maria lopez')).toBe('AM')
    expect(initials('')).toBe('?')
  })
})

describe('unknownPeople', () => {
  const nodes = [{ addedBy: 'a', favouritedBy: ['x', 'me'] }, { editedBy: 'me', downvotedBy: ['y', 'x'] }]
  it('lists ids on boxes that are not in the list of people yet, once each, in order', () => {
    expect(unknownPeople(nodes, people)).toBe('x y')
  })
  it('leaves out you and "me" (a board in this browser)', () => {
    expect(unknownPeople(nodes, people, 'y')).toBe('x')
  })
  it('with no list yet, everyone else is unknown', () => {
    expect(unknownPeople(nodes, null)).toBe('a x y')
  })
})
