// One row of the window per category, lettered from the top. Add a line here and the machine
// grows a row, a letter key and a line on the legend.
export const CATEGORIES = [
  // `sign` is what the LED sign blinks when you get one: eight letters at most.
  // Shrimp × tech colours (the same as the note boxes on the board), spread from dark to light
  // so they still differ in greyscale: D plum · C teal · A shrimp red · E moss · F coral · B amber.
  { name: 'words', sign: 'words', colour: '#d2452f' },
  { name: 'objects', sign: 'objects', colour: '#f2b84b' },
  { name: 'problems', sign: 'problems', colour: '#23726c' },
  { name: 'curiosities', sign: 'curious', colour: '#5b2a3a' },
  { name: 'nature', sign: 'nature', colour: '#7f8d3a' },
  { name: 'constraints', sign: 'limits', colour: '#ef8a6b' },
]
