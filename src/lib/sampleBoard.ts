import { BOARD_VERSION, SWAP_BUDGET, type Board } from './board'

// A starter board so there's something to look at before Batch 2 (sparks) exists.
export function createSampleBoard(now = new Date()): Board {
  const timestamp = now.toISOString()
  return {
    version: BOARD_VERSION,
    id: crypto.randomUUID(),
    name: 'my first board',
    mode: 'blank',
    swapsLeft: SWAP_BUDGET,
    nodes: [
      { id: 'n1', text: 'cassette', kind: 'spark', category: 'words', x: 0, y: 0 },
      { id: 'n2', text: 'Glow-worms recorded in a Kent hedgerow', kind: 'spark', category: 'nature', x: 320, y: 40 },
      { id: 'n3', text: '"My houseplants die while I\'m away"', kind: 'spark', category: 'problems', x: 140, y: 220 },
      { id: 'n4', text: 'mixtapes for plants?', kind: 'user', x: -120, y: 200 },
      { id: 'n5', text: 'what does this sound like?', kind: 'nudge', nudgeType: 'senses', x: 420, y: 230 },
    ],
    links: [
      { from: 'n1', to: 'n4' },
      { from: 'n3', to: 'n4' },
      { from: 'n2', to: 'n5' },
    ],
    createdAt: timestamp,
    updatedAt: timestamp,
  }
}
