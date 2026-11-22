import { beforeEach, describe, expect, it, vi } from 'vitest'
import { parseBoard, type Board } from '../board'
import { addNudge } from '../boardOps'
import { forgetFiles, formsOf, linksOf } from './words'
import { chooseType, chooseWord, distanceFromSpark, fittingTypes, keywordOf, pickNudge, twoStepWildcard } from './pickNudge'
import { fillQuestion } from './questions'

const board: Board = {
  version: 4,
  id: 'b',
  name: 'b',
  nodes: [
    { id: 'n1', number: 1, text: 'cassette', kind: 'spark', category: 'words', x: 0, y: 0 },
    { id: 'n2', number: 2, text: '"My houseplants die while I\'m away"', kind: 'spark', category: 'problems', x: 0, y: 100 },
  ],
  links: [],
  createdAt: '2026-10-28T10:00:00Z',
  updatedAt: '2026-10-28T10:00:00Z',
}

const first = () => 0
// Our word files, served by first two letters: { ca: { cassette: {...} } }.
const fakeWords = (files: Record<string, unknown>) =>
  vi.fn(async (url: string) => {
    const prefix = /\/words\/([a-z]{2})\.json$/.exec(url)?.[1] ?? ''
    return new Response(JSON.stringify(files[prefix] ?? {}), { status: 200 })
  }) as unknown as typeof fetch
const offline = vi.fn(async () => {
  throw new TypeError('offline')
}) as unknown as typeof fetch

const WORDS = {
  ca: { cassette: { related: ['tape', 'music', '<script>'], opposite: ['stream'], usedFor: ['recording music'], rhymes: ['jet set'] } },
  ta: { tape: { related: ['glue', 'measure', 'cassette', 'music'] } },
  mu: { music: { related: ['dance'] } },
}

beforeEach(() => forgetFiles())

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

describe('our word data', () => {
  it('finds a word under its plain form', () => {
    expect(formsOf('clocks')).toContain('clock')
    expect(formsOf('cities')).toContain('city')
    expect(formsOf('boxes')).toContain('box')
    expect(formsOf('glass')).toEqual(['glass'])
  })

  it('reads only the file for its first two letters, and keeps only plain words', async () => {
    const fetchImpl = fakeWords(WORDS)
    const found = await linksOf('cassettes', fetchImpl)
    expect(found?.word).toBe('cassette')
    expect(found?.links.related).toEqual(['tape', 'music'])
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect((fetchImpl as unknown as { mock: { calls: string[][] } }).mock.calls[0][0]).toMatch(/\/words\/ca\.json$/)
  })

  it('gives nothing (and no error) when offline with nothing kept', async () => {
    expect(await linksOf('cassette', offline)).toBeNull()
  })
})

describe('choosing a word', () => {
  it('skips words already on the board and picks from the strongest few', () => {
    const b = { ...board, nodes: [...board.nodes, { id: 'n9', number: 9, text: 'a tape for plants', kind: 'user' as const, x: 0, y: 0 }] }
    expect(chooseWord(['tape', 'music', 'vinyl'], b, first)).toBe('music')
    expect(chooseWord(['alpha', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot', 'golf'], board, () => 0.99)).toBe('echo')
    expect(chooseWord([], board, first)).toBeNull()
  })

  it('makes a two-step wildcard that leads somewhere new', async () => {
    const leap = await twoStepWildcard('cassette', board, first, fakeWords(WORDS))
    // cassette → tape → glue: not cassette itself, and not one of cassette's own associations.
    expect(leap).toEqual({ type: 'wildcard', text: 'wildcard: glue (cassette → tape → glue)' })
  })
})

describe('pickNudge', () => {
  it('gives a word from our data for word nudges', async () => {
    expect(await pickNudge(board, 'n1', { type: 'opposite', random: first, fetchImpl: fakeWords(WORDS) })).toEqual({
      type: 'opposite',
      text: 'opposite of cassette: stream',
    })
    const related = await pickNudge(board, 'n1', { type: 'related', random: first, fetchImpl: fakeWords(WORDS) })
    expect(related?.type).toBe('related')
    expect(related?.text).toMatch(/^(cassette, used for: recording music|cassette → makes people think of: (tape|music)|rhymes with cassette: jet set)$/)
  })

  it('falls back to a question that fits when our data has nothing', async () => {
    const nudge = await pickNudge(board, 'n1', { type: 'described', random: first, fetchImpl: fakeWords(WORDS) })
    // The first fitting question type for a word is perspective.
    expect(nudge).toEqual({ type: 'perspective', text: 'How would a 7-year-old use cassette?' })
  })

  it('fills questions with the idea', async () => {
    expect(await pickNudge(board, 'n1', { type: 'senses', random: first })).toEqual({
      type: 'senses',
      text: 'What does cassette sound like?',
    })
  })

  it('gives a wildcard word that is not already on the board', async () => {
    // The first random number skips the two-step leap; then the first hand-written wildcard.
    const rolls = [0.9]
    const nudge = await pickNudge(board, 'n1', { type: 'wildcard', random: () => rolls.shift() ?? 0, fetchImpl: fakeWords(WORDS) })
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
    expect(r.node).toMatchObject({ number: 3, kind: 'nudge', nudgeType: 'scale' })
    expect(r.board.links).toEqual([{ from: 'n1', to: r.node!.id }])
    expect(parseBoard(r.board).ok).toBe(true)
  })

  it('refuses unknown targets', () => {
    expect(addNudge(board, 'n9', { type: 'push', text: 'x' }, { x: 0, y: 0 }).ok).toBe(false)
  })
})

describe('nudges that fit', () => {
  const b: Board = {
    ...board,
    nodes: [
      ...board.nodes,
      { id: 'n3', number: 3, text: 'mixtape for plants', kind: 'user', x: 0, y: 0 },
      { id: 'n4', number: 4, text: 'a plant that DJs its own playlist while you are away', kind: 'user', x: 0, y: 0 },
      { id: 'n5', number: 5, text: 'what does this sound like?', kind: 'nudge', nudgeType: 'senses', x: 0, y: 0 },
      { id: 'n6', number: 6, text: 'lonely idea', kind: 'user', x: 0, y: 0 },
    ],
    links: [
      { from: 'n1', to: 'n3' },
      { from: 'n3', to: 'n4' },
      { from: 'n1', to: 'n5' },
    ],
  }

  it('measures how far an idea is from a spark', () => {
    expect(distanceFromSpark(b, 'n1')).toBe(0)
    expect(distanceFromSpark(b, 'n3')).toBe(1)
    expect(distanceFromSpark(b, 'n4')).toBe(2)
    expect(distanceFromSpark(b, 'n6')).toBe(Infinity)
  })

  it('gives word nudges to short sparks, and none to problems', () => {
    expect(fittingTypes(b, 'n1')).toContain('related')
    expect(fittingTypes(b, 'n2')).toEqual(['perspective', 'scale', 'push', 'wildcard'])
  })

  it('pushes developed ideas instead of playing word games', () => {
    expect(fittingTypes(b, 'n3')).toContain('related')
    expect(fittingTypes(b, 'n4')).toEqual(['perspective', 'scale', 'push', 'wildcard'])
  })

  it('never nudges a nudge', async () => {
    expect(fittingTypes(b, 'n5')).toEqual([])
    expect(chooseType(b, 'n5')).toBeNull()
    expect(await pickNudge(b, 'n5', { random: first })).toBeNull()
  })

  it('always allows a wildcard', () => {
    for (const id of ['n1', 'n2', 'n3', 'n4', 'n6']) expect(fittingTypes(b, id), id).toContain('wildcard')
  })
})
