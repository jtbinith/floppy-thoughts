import type { VendRow } from '../lib/sparks/vend'

// The machine's rows and their category colours, shared by the machine and the popup.
export const ROWS: { id: VendRow; key: string; label: string; colour: string }[] = [
  { id: 'words', key: 'W', label: 'words', colour: '#ff7a52' },
  { id: 'objects', key: 'O', label: 'objects', colour: '#f2b544' },
  { id: 'problems', key: 'P', label: 'problems', colour: '#7fb7c9' },
  { id: 'curiosities', key: 'C', label: 'curiosities', colour: '#c69ae0' },
  { id: 'nature', key: 'N', label: 'nature', colour: '#9fd46a' },
  { id: 'surprise', key: '?', label: 'surprise me', colour: '#efe7dc' },
]

export const colourOf = (category: string) =>
  category === 'theme' ? '#f6e3cc' : (ROWS.find((r) => r.id === category)?.colour ?? '#ff7a52')
