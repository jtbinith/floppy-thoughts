// The home page, built around the vending machine: what Floppy Thoughts is, the live machine to
// try, how it works, and example boards. Colours come from the site theme (dark or light mode).

import { lazy, Suspense } from 'react'
import { CATEGORIES } from './machine/categories'
import { NavBar } from './NavBar'
import { TypedHeadline } from './type/TypedHeadline'

// The 3D machine loads on its own, so the 3D library only downloads with the home page.
const HomeMachine = lazy(() => import('./machine/HomeMachine'))

type Props = {
  hasBoards: boolean
}

const LETTERS = CATEGORIES.map((_, i) => String.fromCharCode(65 + i))

// Illustrative boards: two capsules each, a trail of thoughts, and where it landed.
const EXAMPLES = [
  { notes: ['A2 cassette', 'C1 my plants die while I’m away'], trail: 'mixtapes for plants? → plants that ask for water', idea: 'a plant sensor that blinks like a firefly, faster the thirstier it gets' },
  { notes: ['B3 pocket sundial', 'E1 dew on a spider web'], trail: 'shadows tell the time → a guessing game', idea: 'a morning-walk game: guess the time from your shadow' },
  { notes: ['F2 one button only', 'D1 octopuses have three hearts'], trail: 'three reminders a day → no screen at all', idea: 'a pill box that taps a tiny Morse reminder on your wrist' },
]

// A capsule code like "A2", in its row's colour, like a key on the machine.
function Code({ code }: { code: string }) {
  const row = CATEGORIES[LETTERS.indexOf(code[0])]
  return <span className={`home__code home__code--${row?.name ?? 'words'}`}>{code}</span>
}

export function Home({ hasBoards }: Props) {
  return (
    <div className="home">
      <NavBar current="home" showBoards={hasBoards} />

      <section className="home__hero">
        <div className="home__inner home__hero-grid">
          <div>
            <TypedHeadline caret="under" />
            <p className="home__lede">
              A vending machine full of shrimp, each holding a random note to get you thinking. Pick a capsule, then follow the thought somewhere unexpected on your own
              board. The idea is still yours.
            </p>
            <p className="home__hint">
              Try the machine: type a row letter like <kbd>B</kbd> (or a slot like <kbd>B2</kbd>) and press <kbd>Enter</kbd>, or <kbd>?</kbd> for a surprise. Drag to turn it.
            </p>
            <div className="home__ctas">
              <a className="home__cta" href="#/new">
                start a board
              </a>
              {hasBoards && (
                <a className="home__cta home__cta--quiet" href="#/board">
                  continue where I left off
                </a>
              )}
            </div>
          </div>
          <div className="home__machine-wrap">
            <Suspense fallback={<div className="home__machine" />}>
              <HomeMachine />
            </Suspense>
          </div>
        </div>
      </section>

      <section className="home__band">
        <div className="home__inner">
          <h2>~/how it works</h2>
          <ol className="home__steps">
            <li>
              <b>1</b>
              <strong>pick a capsule</strong>
              <span>Each row of the machine is a kind of note. Type its code, or press ? for a surprise.</span>
            </li>
            <li>
              <b>2</b>
              <strong>push the thought</strong>
              <span>Add your own thoughts, link them, and ask for a nudge when you&apos;re stuck: a word or a question, never an answer.</span>
            </li>
            <li>
              <b>3</b>
              <strong>land on an idea</strong>
              <span>Follow one thread somewhere unexpected and mark the one you want to build.</span>
            </li>
          </ol>
          <ul className="home__rows" aria-label="The rows of the machine">
            {CATEGORIES.map((c, i) => (
              <li key={c.name} className={`home__code home__code--${c.name}`}>
                <b>{LETTERS[i]}</b> {c.name}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="home__section">
        <div className="home__inner">
          <h2>~/example boards</h2>
          <div className="home__examples">
            {EXAMPLES.map((ex) => (
              <article key={ex.idea} className="home__example">
                {ex.notes.map((n) => (
                  <p key={n} className="home__note">
                    <Code code={n.slice(0, 2)} /> {n.slice(3)}
                  </p>
                ))}
                <p className="home__trail">{ex.trail}</p>
                <p className="home__idea">
                  <span>idea</span> {ex.idea}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="home__band home__end">
        <div className="home__inner">
          <h2 className="home__end-title">404: idea not found... yet</h2>
          <a className="home__cta" href="#/new">
            start a board
          </a>
        </div>
      </section>

      <footer className="home__footer">
        <span>Floppy Thoughts · ideas worth hacking on</span>
        <span>
          built with <a href="https://reactflow.dev">React Flow</a>, <a href="https://threejs.org">three.js</a>, <a href="https://zod.dev">Zod</a> and{' '}
          <a href="https://www.datamuse.com/api/">Datamuse</a>
        </span>
        <span title="Seriously, how is your posture right now?">🦐 sit up straight</span>
      </footer>
    </div>
  )
}
