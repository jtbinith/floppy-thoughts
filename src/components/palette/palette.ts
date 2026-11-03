// PROTOTYPE: the site's colour palette, "shrimp × tech", shown on #/palette. A small earthy set
// (after isometric shop illustrations), all slightly muted so the colours sit together: shrimp
// red and coral for the shrimp; cream "terminal paper", amber LED and circuit teal for the tech;
// moss and plum to round it out. Dark mode and light mode share the same accents.

export type Swatch = { name: string; hex: string }

// Where the colours came from.
export const SOURCES: { title: string; note: string; swatches: Swatch[] }[] = [
  {
    title: 'isometric shops',
    note: 'earthy, muted, inked: brick red, cream, mustard, moss, teal on stone',
    swatches: [
      { name: 'brick red', hex: '#d2452f' },
      { name: 'cream', hex: '#f6eedd' },
      { name: 'mustard', hex: '#e0ab3e' },
      { name: 'moss', hex: '#7f8d3a' },
      { name: 'teal', hex: '#23726c' },
      { name: 'stone', hex: '#d8d1c3' },
      { name: 'ink', hex: '#2b1d18' },
    ],
  },
  {
    title: 'shrimp',
    note: 'the shrimp itself: coral, shrimp red, a pink highlight',
    swatches: [
      { name: 'coral', hex: '#ef8a6b' },
      { name: 'shrimp red', hex: '#d2452f' },
      { name: 'deep red', hex: '#9e2e1c' },
      { name: 'highlight', hex: '#ffc2a8' },
    ],
  },
  {
    title: 'tech',
    note: 'terminal paper, an amber LED, circuit-board teal',
    swatches: [
      { name: 'paper', hex: '#efe7d6' },
      { name: 'amber LED', hex: '#f2b84b' },
      { name: 'circuit teal', hex: '#23726c' },
      { name: 'light teal', hex: '#5fb3a9' },
      { name: 'charcoal', hex: '#1f1b18' },
    ],
  },
]

// The palette: each colour with a job.
export type Role = Swatch & { use: string }
export const PALETTE: { group: string; roles: Role[] }[] = [
  {
    group: 'dark mode',
    roles: [
      { name: 'charcoal', hex: '#1f1b18', use: 'page background' },
      { name: 'screen', hex: '#191512', use: 'the board' },
      { name: 'panel', hex: '#2b2622', use: 'cards, bands, menus' },
      { name: 'line', hex: '#3f3731', use: 'borders, dividers' },
      { name: 'cream', hex: '#f6eedd', use: 'main text, "ideas worth"' },
      { name: 'muted', hex: '#b3a58f', use: 'secondary text' },
    ],
  },
  {
    group: 'light mode',
    roles: [
      { name: 'stone', hex: '#d8d1c3', use: 'page background' },
      { name: 'paper', hex: '#efe7d6', use: 'the board, bands' },
      { name: 'cream', hex: '#f6eedd', use: 'cards' },
      { name: 'line', hex: '#b9ad99', use: 'borders, dividers' },
      { name: 'ink', hex: '#2b1d18', use: 'main text, "ideas worth"' },
      { name: 'muted', hex: '#5e4d42', use: 'secondary text' },
    ],
  },
  {
    group: 'accents',
    roles: [
      { name: 'coral', hex: '#ef8a6b', use: 'buttons, "hacking on" in dark mode' },
      { name: 'shrimp red', hex: '#d2452f', use: '"hacking on" in light mode (big text only)' },
      { name: 'deep red', hex: '#b33a25', use: 'small accent text in light mode' },
      { name: 'amber', hex: '#f2b84b', use: 'headings in dark mode, the LED sign' },
      { name: 'deep teal', hex: '#1b5a55', use: 'headings in light mode' },
      { name: 'circuit teal', hex: '#23726c', use: 'the machine, the board frame' },
    ],
  },
]

// The machine's rows, also used for the note boxes on the board. Spread from dark to light so
// they still differ in greyscale: D plum · C teal · A shrimp red · E moss · F coral · B amber.
export const CATEGORY_COLOURS: Swatch[] = [
  { name: 'A words', hex: '#d2452f' },
  { name: 'B objects', hex: '#f2b84b' },
  { name: 'C problems', hex: '#23726c' },
  { name: 'D curiosities', hex: '#5b2a3a' },
  { name: 'E nature', hex: '#7f8d3a' },
  { name: 'F constraints', hex: '#ef8a6b' },
]

// Text colours to test against every background.
export const TEXTS: Swatch[] = [
  { name: 'cream', hex: '#f6eedd' },
  { name: 'muted (dark)', hex: '#b3a58f' },
  { name: 'ink', hex: '#2b1d18' },
  { name: 'muted (light)', hex: '#5e4d42' },
  { name: 'coral', hex: '#ef8a6b' },
  { name: 'amber', hex: '#f2b84b' },
]
export const BACKGROUNDS: Swatch[] = [
  { name: 'charcoal', hex: '#1f1b18' },
  { name: 'panel', hex: '#2b2622' },
  { name: 'stone', hex: '#d8d1c3' },
  { name: 'paper', hex: '#efe7d6' },
  ...CATEGORY_COLOURS,
]
