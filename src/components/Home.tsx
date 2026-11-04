// The home page, built around the vending machine: what Floppy Thoughts is, the live machine to
// try, how it works (shown with small pictures made of the board's own pieces), working on a board
// together, and a last call to start. Colours come from the site theme (dark or light mode).

import { lazy, Suspense, useState } from 'react'
import { CATEGORY_LABEL, type SparkCategory } from '../lib/board'
import { CATEGORIES } from './machine/categories'
import { HeartIcon } from './HeartIcon'
import { NavBar } from './NavBar'
import { SiteFooter } from './InfoPages'
import { TypedHeadline } from './TypedHeadline'

// The 3D machine loads on its own, so the 3D library only downloads with the home page.
const HomeMachine = lazy(() => import('./machine/HomeMachine'))

type Props = {
  hasBoards: boolean
}

type Row = Exclude<SparkCategory, 'theme'>

// One example per row of the machine, followed through all three steps: the note it gives you,
// a thought it leads to, a nudge, and the idea it lands on.
const EXAMPLES: Record<Row, { note: string; thought: string; nudge: string; idea: string }> = {
  words: { note: 'cassette', thought: 'a mixtape you swap with a stranger', nudge: 'what if it was anonymous?', idea: 'an app that swaps playlists with a stranger each week' },
  objects: { note: 'a pocket sundial', thought: 'shadows that tell the time', nudge: 'what if it ran backwards?', idea: 'a morning-walk game: guess the time from your shadow' },
  problems: { note: 'my plants die while I’m away', thought: 'plants that ask for help', nudge: 'what if a neighbour could answer?', idea: 'a street map where neighbours offer to water each other’s plants' },
  curiosities: { note: 'octopuses have three hearts', thought: 'one body, three backups', nudge: 'what else needs a backup?', idea: 'a password vault that splits your key between three friends' },
  nature: { note: 'dew on a spider web', thought: 'a web that catches what passes by', nudge: 'what passes you by every day?', idea: 'a browser extension that catches the links you meant to come back to' },
  constraints: { note: 'made for someone over 80', thought: 'my gran misses hearing from us', nudge: 'what if it had no screen?', idea: 'a photo frame that glows with a grandchild’s face when they tap “thinking of you”' },
}

export function Home({ hasBoards }: Props) {
  // The capsule picked in step 1, followed through steps 2 and 3.
  const [row, setRow] = useState<Row>('objects')
  const ex = EXAMPLES[row]
  const label = `~/${CATEGORY_LABEL[row]}`
  return (
    <div className="home">
      <NavBar current="home" />

      <section className="home__hero">
        <div className="home__inner home__hero-grid">
          <div>
            <TypedHeadline caret="under" />
            <p className="home__lede">
              Pull a random note from the shrimp machine, follow where it leads and land on a project worth building. On your own or with your team.
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
              <div className="show">
                <div className="show__capsules" role="group" aria-label="Pick a capsule to see an example">
                  {CATEGORIES.map((c) => (
                    <button
                      key={c.name}
                      type="button"
                      className={`show__capsule show__capsule--${c.name}`}
                      aria-label={`${c.name}`}
                      aria-pressed={row === c.name}
                      title={c.name}
                      onClick={() => setRow(c.name as Row)}
                    />
                  ))}
                </div>
                <div className={`mini mini--${row}`} aria-live="polite">
                  <span className="mini__label">{label}</span>
                  <span className="mini__text">{ex.note}</span>
                </div>
              </div>
              <strong>pick a capsule</strong>
              <span>Each colour is a different kind of note. Tap one to see.</span>
            </li>
            <li>
              <div className="show show--chain" aria-hidden="true">
                <div className={`mini mini--${row}`}>
                  <span className="mini__label">{label}</span>
                  <span className="mini__text">{ex.note}</span>
                </div>
                <span className="show__link" />
                <div className="mini">
                  <span className="mini__label">~/idea</span>
                  <span className="mini__text">{ex.thought}</span>
                </div>
                <div className="mini mini--nudge">
                  <span className="mini__text">// {ex.nudge}</span>
                </div>
              </div>
              <strong>follow the thought</strong>
              <span>Add ideas, link them and ask for a nudge when you&apos;re stuck.</span>
            </li>
            <li>
              <div className="show" aria-hidden="true">
                <div className="mini mini--picked">
                  <span className="mini__label">
                    ~/idea <HeartIcon size={9} />
                  </span>
                  <span className="mini__text">{ex.idea}</span>
                </div>
              </div>
              <strong>land on an idea</strong>
              <span>Favourite the ones you&apos;d build and see how you got there.</span>
            </li>
          </ol>
        </div>
      </section>

      <section className="home__section">
        <div className="home__inner home__together">
          <div>
            <h2>~/better together</h2>
            <ul className="home__uses">
              <li>
                <strong>kick off a hackathon</strong>
                <span>Share one link and the whole team brainstorms on the same board, then favourite the idea you&apos;ll build.</span>
              </li>
              <li>
                <strong>run a workshop or a class</strong>
                <span>Give everyone the link. Let them add ideas or just watch and favourite.</span>
              </li>
              <li>
                <strong>plan a side project with a friend</strong>
                <span>Keep adding to the same board from wherever you are.</span>
              </li>
            </ul>
            <p className="home__assure">Sign in with GitHub to share a board.</p>
          </div>
          <div className="show show--bar" aria-hidden="true">
            <span className="show__menus">Board Edit View</span>
            <span className="show__name">hackathon kick-off</span>
            <span className="show__faces">
              <i>JT</i>
              <i>AK</i>
              <i>RM</i>
            </span>
            <span className="show__share">share</span>
          </div>
        </div>
      </section>

      <section className="home__band">
        <div className="home__inner home__together">
          <div className={`show show--term mini--${row}`} aria-hidden="true">
            <p>
              <span>~ %</span> /vend <b className="show__slot">{row}</b>
            </p>
            <p className="show__out">a shrimp is on its way… then /stick, /swap or /back</p>
            <p>
              <span>~ %</span> /stick
            </p>
            <p className="show__out">stuck on the board: {ex.note}</p>
            <p>
              <span>~ %</span> {ex.thought}
            </p>
            <p className="show__out">added 2: {ex.thought}</p>
            <p>
              <span>~ %</span> /link 1 2
            </p>
            <p className="show__out">linked 1 to 2</p>
            <p>
              <span>~ %</span> {ex.idea}
            </p>
            <p className="show__out">added 3: {ex.idea}</p>
            <p>
              <span>~ %</span> /fav 3<span className="show__caret">_</span>
            </p>
          </div>
          <div>
            <h2>~/hands on the keyboard</h2>
            <ul className="home__uses">
              <li>
                <strong>type a thought, press enter</strong>
                <span>It&apos;s on the board. No clicking around.</span>
              </li>
              <li>
                <strong>a command for everything</strong>
                <span>Vend a note, link, favourite and tidy with commands like /vend, /link and /fav. Tab finishes them for you.</span>
              </li>
              <li>
                <strong>move like vim</strong>
                <span>Hop between boxes with h j k l. Press ? on the board for every shortcut.</span>
              </li>
            </ul>
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

      <SiteFooter />
    </div>
  )
}
