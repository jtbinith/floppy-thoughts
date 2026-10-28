import { describe, expect, it, vi } from 'vitest'
import { parseBoard, type Board } from '../board'
import { addNudge } from '../boardOps'
import { fetchWords } from './datamuse'
import { chooseType, keywordOf, pickNudge } from './pickNudge'
import { fillQuestion } from './questions'

const board: Board = {
  version: 1,
  id: 'b',
  name: 'b',
  mode: 'blank',
  swapsLeft: 3,
  nodes: [
    { id: 'n1', text: 'cassette', kind: 'spark', category: 'words', x: 0, y: 0 },
    { id: 'n2', text: '"My houseplants die while I\'m away"', kind: 'spark', category: 'problems', x: 0, y: 100 },
  ],
  links: [],
  createdAt: '2026-10-28T10:00:00Z',
  updatedAt: '2026-10-28T10:00:00Z',
}

const first = () => 0
const fakeFetch = (words: unknown) =>
  vi.fn(async () => new Response(JSON.stringify(words), { status: 200 })) as unknown as typeof fetch

describe('keywordOf', () => {
  it('picks the most meaningful word', () => {
    expect(keywordOf('cassette')).toBe('cassette')
    expect(keywordOf('"My houseplants die while I\'m away"')).toBe('houseplants')
    expect(keywordOf('Glow-worms recorded in a Kent hedgerow')).toBe('hedgerow')
    expect(keywordOf('a of the')).toBeNull()
  })
})

describe('fillQuestion', () => {
  it('uses short ideas and says "this" for long ones', () => {
    expect(fillQuestion('What does {x} sound like?', 'Cassette')).toBe('What does cassette sound like?')
    expect(fillQuestion('What does {x} sound like?', 'a very long idea about many things')).toBe('What does this sound like?')
  })
})

describe('fetchWords', () => {
  it('sends one keyword and keeps only plain words', async () => {
    const fetchImpl = fakeFetch([{ word: 'tape' }, { word: '<script>' }, { word: 'CASSETTE' }, { score: 3 }, { word: 'vinyl' }])
    expect(await fetchWords('related', 'cassette', fetchImpl)).toEqual(['tape', 'vinyl'])
    expect(fetchImpl).toHaveBeenCalledWith('https://api.datamuse.com/words?rel_trg=cassette&max=20', expect.anything())
  })

  it('returns nothing when offline or the reply is odd', async () => {
    const offline = vi.fn(async () => {
      throw new TypeError('offline')
    }) as unknown as typeof fetch
    expect(await fetchWords('related', 'cassette', offline)).toEqual([])
    expect(await fetchWords('related', 'cassette', fakeFetch({ not: 'a list' }))).toEqual([])
  })
})

describe('pickNudge', () => {
  it('gives a Datamuse word for related nudges', async () => {
    const nudge = await pickNudge(board, 'n1', { type: 'related', random: first, fetchImpl: fakeFetch([{ word: 'tape' }]) })
    expect(nudge).toEqual({ type: 'related', text: 'cassette → makes people think of: tape' })
  })

  it('falls back to a question when Datamuse has nothing', async () => {
    const nudge = await pickNudge(board, 'n1', { type: 'opposite', random: first, fetchImpl: fakeFetch([]) })
    expect(nudge).toEqual({ type: 'push', text: 'Make it weirder.' })
  })

  it('fills questions with the idea', async () => {
    expect(await pickNudge(board, 'n1', { type: 'senses', random: first })).toEqual({
      type: 'senses',
      text: 'What does cassette sound like?',
    })
  })

  it('gives a wildcard word that is not already on the board', async () => {
    const nudge = await pickNudge(board, 'n1', { type: 'wildcard', random: first })
    expect(nudge).toEqual({ type: 'wildcard', text: 'wildcard: banana' })
  })

  it('avoids repeating a nudge type already attached to that idea', () => {
    const withNudge = addNudge(board, 'n1', { type: 'related', text: 'tape' }, { x: 0, y: 0 })
    if (!withNudge.ok) throw new Error()
    for (let i = 0; i < 20; i++) expect(chooseType(withNudge.board, 'n1', () => i / 20)).not.toBe('related')
  })
})

describe('addNudge', () => {
  it('adds a linked nudge node and keeps the board valid', () => {
    const r = addNudge(board, 'n1', { type: 'scale', text: 'What if cassette was the size of a city?' }, { x: 5, y: 5 })
    if (!r.ok) throw new Error(r.error)
    expect(r.node).toMatchObject({ id: 'n3', kind: 'nudge', nudgeType: 'scale' })
    expect(r.board.links).toEqual([{ from: 'n1', to: 'n3' }])
    expect(parseBoard(r.board).ok).toBe(true)
  })

  it('refuses unknown targets', () => {
    expect(addNudge(board, 'n9', { type: 'push', text: 'x' }, { x: 0, y: 0 }).ok).toBe(false)
  })
})
