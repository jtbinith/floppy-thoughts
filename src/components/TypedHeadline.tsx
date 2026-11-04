import { useEffect, useState } from 'react'

// "ideas worth hacking on", typed out letter by letter with a blinking cursor at the end.
// Screen readers get the full headline at once (aria-label); the typed letters are hidden from
// them. With "reduce motion" on, it shows the whole headline straight away and the cursor stays still.

export type Caret = 'block' | 'bar' | 'under'

const FIRST = 'ideas worth '
const SECOND = 'hacking on'
const FULL = FIRST + SECOND

// The keystrokes, like a person who knows what they're writing: each word in a quick burst, a beat
// between words and a longer think before "hacking on". Then one slip ("hacj"), a moment to
// notice it, a backspace and on again. Each step is what's on screen and how long before it shows.
type Step = { text: string; wait: number }
function keystrokes(): Step[] {
  const steps: Step[] = []
  let text = ''
  const type = (chars: string, first: number) =>
    [...chars].forEach((c, i) => {
      text += c
      steps.push({ text, wait: i === 0 ? first : 55 })
    })
  type('ideas', 500)
  type(' worth', 260)
  type(' ', 260)
  type('hac', 800)
  type('j', 55)
  text = text.slice(0, -1)
  steps.push({ text, wait: 380 })
  type('king', 170)
  type(' on', 260)
  return steps
}
const STEPS = keystrokes()

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

export function TypedHeadline({ caret = 'block' }: { caret?: Caret }) {
  const [step, setStep] = useState(() => (reducedMotion() ? STEPS.length : 0))
  useEffect(() => {
    if (step >= STEPS.length) return
    const t = window.setTimeout(() => setStep((n) => n + 1), STEPS[step].wait)
    return () => window.clearTimeout(t)
  }, [step])

  const text = step === 0 ? '' : step >= STEPS.length ? FULL : STEPS[step - 1].text
  const first = text.slice(0, FIRST.length)
  const second = text.slice(FIRST.length)
  const done = step >= STEPS.length
  const onFirst = text.length <= FIRST.length
  const cursor = <i className={`typed__caret typed__caret--${caret}${done ? ' typed__caret--blink' : ''}`} />

  return (
    <h1 className="typed" aria-label={FULL}>
      <span aria-hidden="true" className="typed__line">
        {first}
        {onFirst && cursor}
      </span>
      <span aria-hidden="true" className="typed__line typed__line--accent">
        {second}
        {!onFirst && cursor}
        {/* Keeps the second line's height while it's still empty, so the page doesn't jump. */}
        {!second && ' '}
      </span>
    </h1>
  )
}
