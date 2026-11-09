// The notes in the vending machine, one file per row in src/content/notes/. Rules for adding
// them are in src/content/notes/README.md: concrete, picturable, true, kind and never a finished
// idea. Facts (curiosities, and geography in nature) carry a source.
import constraints from '../../content/notes/constraints.json'
import curiosities from '../../content/notes/curiosities.json'
import nature from '../../content/notes/nature.json'
import objects from '../../content/notes/objects.json'
import problems from '../../content/notes/problems.json'
import words from '../../content/notes/words.json'

// Where a note came from: written by hand, or picked from an open dataset (and reworded).
export type NoteOrigin = 'hand' | 'met' | 'wordnet' | 'wikidata'
export type NoteEntry = { text: string; origin: NoteOrigin; source?: string }

export const NOTES = { words, problems, objects, curiosities, nature, constraints } as Record<
  'words' | 'problems' | 'objects' | 'curiosities' | 'nature' | 'constraints',
  NoteEntry[]
>

// Just the text of each row, which is what the machine deals from.
export const SPARKS = Object.fromEntries(Object.entries(NOTES).map(([row, notes]) => [row, notes.map((n) => n.text)])) as Record<
  keyof typeof NOTES,
  string[]
>

export type ContentCategory = keyof typeof SPARKS
export const CONTENT_CATEGORIES = Object.keys(SPARKS) as ContentCategory[]
