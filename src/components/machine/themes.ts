// PROTOTYPE: colour versions of the machine to compare, all from the site palette (#/palette).

export type MachineTheme = {
  id: string
  label: string
  floor: string
  body: string
  // Behind the capsules in the window.
  window: string
  // Shelves, the window frame and the chute flap.
  trim: string
  chute: string
  signCase: string
  signRim: string
}

export const THEMES: MachineTheme[] = [
  { id: 'teal', label: 'circuit teal', floor: '#1f1b18', body: '#23726c', window: '#2b1d18', trim: '#f6eedd', chute: '#2b1d18', signCase: '#2b1d18', signRim: '#ef8a6b' },
  // Shrimp × tech: brick-red body like the reference buildings, cream trim, mustard sign.
  { id: 'shrimp', label: 'shrimp red', floor: '#1f1b18', body: '#d2452f', window: '#2b1d18', trim: '#f6eedd', chute: '#2b1d18', signCase: '#2b1d18', signRim: '#e0ab3e' },
  { id: 'paper', label: 'paper', floor: '#1f1b18', body: '#f6eedd', window: '#2b1d18', trim: '#d2452f', chute: '#2b1d18', signCase: '#2b1d18', signRim: '#23726c' },
  { id: 'peach', label: 'peach', floor: '#17110e', body: '#fce4b4', window: '#540c3c', trim: '#ff7a52', chute: '#17110e', signCase: '#17110e', signRim: '#b43c54' },
  { id: 'orange', label: 'orange', floor: '#17110e', body: '#ff7a52', window: '#540c3c', trim: '#fce4b4', chute: '#17110e', signCase: '#17110e', signRim: '#fce4b4' },
  { id: 'sky', label: 'sky', floor: '#17110e', body: '#9ccce4', window: '#540c3c', trim: '#fcfce4', chute: '#17110e', signCase: '#17110e', signRim: '#ff7a52' },
  { id: 'magenta', label: 'magenta', floor: '#17110e', body: '#840c6c', window: '#2a061e', trim: '#fce4b4', chute: '#17110e', signCase: '#17110e', signRim: '#cce454' },
  { id: 'lime', label: 'lime', floor: '#17110e', body: '#cce454', window: '#540c3c', trim: '#fcfce4', chute: '#17110e', signCase: '#17110e', signRim: '#840c6c' },
  { id: 'two-tone', label: 'two-tone', floor: '#17110e', body: '#b43c54', window: '#17110e', trim: '#9ccce4', chute: '#17110e', signCase: '#17110e', signRim: '#9ccce4' },
  { id: 'ink', label: 'ink', floor: '#17110e', body: '#2e221b', window: '#17110e', trim: '#ff7a52', chute: '#0d0907', signCase: '#17110e', signRim: '#ff7a52' },
  { id: 'ink-peach', label: 'ink + peach', floor: '#17110e', body: '#2e221b', window: '#17110e', trim: '#fce4b4', chute: '#0d0907', signCase: '#17110e', signRim: '#fce4b4' },
  { id: 'ink-match', label: 'ink-matched', floor: '#17110e', body: '#17110e', window: '#0d0907', trim: '#ff7a52', chute: '#0d0907', signCase: '#0d0907', signRim: '#ff7a52' },
  { id: 'plum', label: 'plum', floor: '#17110e', body: '#540c3c', window: '#2a061e', trim: '#fce4b4', chute: '#17110e', signCase: '#17110e', signRim: '#cce454' },
  { id: 'before', label: 'before', floor: '#2a1d16', body: '#c4733a', window: '#5a2f17', trim: '#e2955a', chute: '#140d0a', signCase: '#2a1a12', signRim: '#ff7a52' },
]
