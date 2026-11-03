// PROTOTYPE: the site's colours, to compare on #/look. Each section of the page can have its own
// colours, for colour blocking.

export type SectionColours = {
  bg: string
  text: string
  muted: string
  // Headings' second line ("hacking on"), links and highlights.
  accent: string
}

export type Look = {
  id: string
  label: string
  note: string
  // Which machine colour version to show (see machine/themes.ts).
  machine: string
  // Borrow the machine's category colours for headings, step numbers and example notes.
  rainbow?: boolean
  // Show capsule codes (A2, C1…) as chips in their row's colour, without colouring anything else.
  chips?: boolean
  // A colour for section headings and step numbers, if different from the accent.
  headings?: string
  // Other colours for the machine's six rows (A–F), if this palette recolours them.
  categories?: string[]
  button: { bg: string; text: string; shadow: string }
  sections: { hero: SectionColours; how: SectionColours; examples: SectionColours; cta: SectionColours }
}

// Shrimp × tech: a small earthy set (after isometric shop illustrations), all slightly muted so
// they sit together. Shrimp red and coral for the shrimp; cream "terminal paper", amber LED and
// circuit teal for the tech; moss and plum to round it out.
export const SHRIMP_TECH = {
  charcoal: '#1f1b18',
  panel: '#2b2622',
  stone: '#d8d1c3',
  paper: '#efe7d6',
  cream: '#f6eedd',
  ink: '#2b1d18',
  mutedDark: '#b3a58f',
  mutedLight: '#5e4d42',
  shrimp: '#d2452f',
  deepRed: '#9e2e1c',
  coral: '#ef8a6b',
  amber: '#f2b84b',
  teal: '#23726c',
  deepTeal: '#1b5a55',
  lightTeal: '#5fb3a9',
  moss: '#7f8d3a',
  plum: '#5b2a3a',
}
const C = SHRIMP_TECH

// The machine's rows A–F. Dark to light: D plum · C teal · A shrimp red · E moss · F coral · B amber,
// so they still differ in greyscale.
const ROWS = [C.shrimp, C.amber, C.teal, C.plum, C.moss, C.coral]

const button = { bg: C.coral, text: C.ink, shadow: C.deepRed }

// Shrimp × tech, in dark and light mode. Both use the circuit-teal machine.
export const LOOKS: Look[] = [
  {
    id: 'dark',
    label: 'dark mode',
    note: 'warm charcoal, cream text, coral "hacking on", amber LED headings, circuit teal links',
    machine: 'teal',
    chips: true,
    headings: C.amber,
    categories: ROWS,
    button,
    sections: {
      hero: { bg: C.charcoal, text: C.cream, muted: C.mutedDark, accent: C.coral },
      how: { bg: C.panel, text: C.cream, muted: C.mutedDark, accent: C.coral },
      examples: { bg: C.charcoal, text: C.cream, muted: C.mutedDark, accent: C.lightTeal },
      cta: { bg: C.panel, text: C.cream, muted: C.mutedDark, accent: C.coral },
    },
  },
  {
    id: 'light',
    label: 'light mode',
    note: 'light stone, ink text, shrimp-red "hacking on", deep teal headings',
    machine: 'teal',
    chips: true,
    headings: C.deepTeal,
    categories: ROWS,
    button,
    sections: {
      hero: { bg: C.stone, text: C.ink, muted: C.mutedLight, accent: C.shrimp },
      how: { bg: C.paper, text: C.ink, muted: C.mutedLight, accent: C.deepRed },
      examples: { bg: C.stone, text: C.ink, muted: C.mutedLight, accent: C.deepRed },
      cta: { bg: C.ink, text: C.cream, muted: C.mutedDark, accent: C.coral },
    },
  },
]
