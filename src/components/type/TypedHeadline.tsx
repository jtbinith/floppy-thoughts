import { useEffect, useState } from 'react'

// "ideas worth hacking on", typed out letter by letter with a blinking cursor at the end.
// Screen readers get the full headline at once (aria-label); the typed letters are hidden from
// them. With "reduce motion" on, it shows the whole headline straight away and the cursor stays still.

export type Caret = 'block' | 'bar' | 'under'

const FIRST = 'ideas worth '
const SECOND = 'hacking on'
const FULL = FIRST + SECOND
const PAUSE_MS = 550 // a little think before "hacking on"

const between = (lo: number, hi: number) => lo + Math.random() * (hi - lo)

// How long to wait before typing the next letter, like a person: uneven, a beat after each space
// (finding the next word), now and then a short hesitation, and quick runs in the middle of words.
function nextDelay(typed: string) {
  if (typed.length === 0) return between(400, 700) // settling in before the first key
  if (typed.length === FIRST.length) return PAUSE_MS
  const last = typed.at(-1)
  if (last === ' ') return between(150, 280)
  if (Math.random() < 0.1) return between(220, 420)
  return between(45, 150)
}

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

export function TypedHeadline({ caret = 'block' }: { caret?: Caret }) {
  const [shown, setShown] = useState(() => (reducedMotion() ? FULL.length : 0))
  useEffect(() => {
    if (shown >= FULL.length) return
    const t = window.setTimeout(() => setShown((n) => n + 1), nextDelay(FULL.slice(0, shown)))
    return () => window.clearTimeout(t)
  }, [shown])

  const first = FULL.slice(0, Math.min(shown, FIRST.length))
  const second = shown > FIRST.length ? FULL.slice(FIRST.length, shown) : ''
  const done = shown >= FULL.length
  const cursor = <i className={`typed__caret typed__caret--${caret}${done ? ' typed__caret--blink' : ''}`} />

  return (
    <h1 className="typed" aria-label={FULL}>
      <span aria-hidden="true" className="typed__line">
        {first}
        {shown <= FIRST.length && cursor}
      </span>
      <span aria-hidden="true" className="typed__line typed__line--accent">
        {second}
        {shown > FIRST.length && cursor}
        {/* Keeps the second line's height while it's still empty, so the page doesn't jump. */}
        {!second && ' '}
      </span>
    </h1>
  )
}
