// Hand-written nudges. Each is a question or a single word, never an idea.
// `{x}` is replaced with the idea being nudged (or "this" if it's long).

export const QUESTIONS = {
  perspective: [
    'How would a 7-year-old use {x}?',
    'What would {x} mean to someone who has never seen a screen?',
    'How would a lighthouse keeper in 1890 solve this?',
    'What would a dog make of {x}?',
    'Who would hate {x}? What would they change?',
    'How would someone with only one free hand use {x}?',
    'What would your grandparent say {x} is for?',
    'How would an astronaut on the ISS use {x}?',
    'What would {x} look like to a bee?',
    'Who is left out by {x}?',
  ],
  scale: [
    'What if {x} was the size of a city?',
    'What if {x} only lasted ten seconds?',
    'What if a million people used {x} at once?',
    "What's the tiniest possible version of {x}?",
    'What if {x} took a hundred years?',
    'What if only one person in the world could use {x}?',
    'What if {x} had to fit in a pocket?',
    'What would {x} look like for a whole street?',
  ],
  senses: [
    'What does {x} sound like?',
    'What would {x} smell like?',
    'How could you feel {x} without looking at it?',
    'What colour is {x}?',
    'What if {x} could only be heard, never seen?',
    'What would {x} taste like?',
    'How does {x} change in the dark?',
    'What texture is {x}?',
  ],
  push: [
    'Make it weirder.',
    'Remove the screen. What is left?',
    'What if it only worked once?',
    'Who does this fail for?',
    'What would everyone else build? Do the opposite.',
    'What if it had to work offline?',
    'Make it physical.',
    'What if it was a game?',
    'What if it had to be silent?',
    'What would make someone laugh out loud?',
    'What if it ran on a single button?',
    'What is the part you would demo first?',
  ],
} as const

// Concrete, picturable nouns for wildcard nudges: deliberately unrelated to anything.
export const WILDCARDS = [
  'banana', 'mammoth', 'cassette', 'lighthouse', 'kettle', 'glacier', 'trumpet', 'jellyfish',
  'magnet', 'accordion', 'compass', 'umbrella', 'volcano', 'hedgehog', 'telescope', 'pinecone',
  'submarine', 'teapot', 'kite', 'beehive', 'snow globe', 'typewriter', 'cactus', 'parachute',
  'lantern', 'octopus', 'sandcastle', 'metronome', 'dominoes', 'windmill', 'origami', 'skateboard',
  'barometer', 'canoe', 'puppet', 'hourglass', 'mosaic', 'jukebox', 'fossil', 'tightrope',
] as const

export type QuestionType = keyof typeof QUESTIONS

// Short ideas are quoted into the question; long ones become "this" so the question stays readable.
export function fillQuestion(template: string, subject: string): string {
  const words = subject.trim().split(/\s+/)
  const x = words.length <= 4 && subject.length <= 32 ? subject.trim().toLowerCase().replace(/^"|"$/g, '') : 'this'
  return template.replaceAll('{x}', x)
}
