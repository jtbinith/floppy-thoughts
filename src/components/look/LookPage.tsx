import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { bestText, contrast, rate } from '../../lib/contrast'
import { CATEGORIES } from '../machine/categories'
import { createMachineScene, type MachineScene } from '../machine/scene'
import { THEMES } from '../machine/themes'
import { LOOKS, type SectionColours } from './looks'

// PROTOTYPE: the home page redesigned around the vending machine, in each palette version, to
// see how the colours work across the site and how the machine fits in. Lives at #/look.

const LETTERS = CATEGORIES.map((_, i) => String.fromCharCode(65 + i))
const defaultColours = CATEGORIES.map((c) => c.colour)
const labelOn = (bg: string) => bestText(bg, ['#17110e', '#f6e3cc'])
// A category colour as text, if it reads well enough on this background; otherwise the fallback.
const readable = (colour: string, bg: string, fallback: string) => (contrast(colour, bg) >= 4.5 ? colour : fallback)

// A capsule code like "A2" as a little chip in its row's colour, like the machine's keys.
function Code({ code, colours }: { code: string; colours: string[] }) {
  const bg = colours[LETTERS.indexOf(code[0])] ?? '#f6e3cc'
  return (
    <span className="look-code" style={{ background: bg, color: labelOn(bg) }}>
      {code}
    </span>
  )
}

const EXAMPLES = [
  { notes: ['A2 > cassette', 'C1 > my plants die while I’m away'], trail: 'mixtapes for plants? → plants that ask for water', idea: 'a plant sensor that blinks like a firefly, faster the thirstier it gets' },
  { notes: ['B3 > pocket sundial', 'E1 > dew on a spider web'], trail: 'shadows tell the time → a guessing game', idea: 'a morning-walk game: guess the time from your shadow' },
  { notes: ['F2 > one button only', 'D1 > octopuses have three hearts'], trail: 'three reminders a day → no screen at all', idea: 'a pill box that taps a tiny morse reminder on your wrist' },
]

// A section's colours as CSS variables, with its contrast scores shown in the corner.
function Section({ colours, className, children }: { colours: SectionColours; className: string; children: ReactNode }) {
  const style = { '--s-bg': colours.bg, '--s-text': colours.text, '--s-muted': colours.muted, '--s-accent': colours.accent } as CSSProperties
  const score = (fg: string) => {
    const r = contrast(fg, colours.bg)
    return `${r.toFixed(1)} ${rate(r)}`
  }
  return (
    <section className={`look-s ${className}`} style={style}>
      <span className="look-score" title="Contrast with the section background (WCAG)">
        text {score(colours.text)} · muted {score(colours.muted)} · accent {score(colours.accent)}
      </span>
      {children}
    </section>
  )
}

// The live machine, in the colour version this look uses.
function Machine({ machineId, categories, onReady }: { machineId: string; categories?: string[]; onReady: (scene: MachineScene | null) => void }) {
  const stage = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!stage.current) return
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const theme = THEMES.find((t) => t.id === machineId) ?? THEMES[0]
    const scene = createMachineScene(stage.current, { reducedMotion, theme, embedded: true, categoryColours: categories })
    onReady(scene)
    return () => {
      onReady(null)
      scene.dispose()
    }
  }, [machineId, categories, onReady])
  return <div className="look-machine" ref={stage} aria-label="A vending machine full of shrimp capsules. Type a code like B2, or press get a shrimp." role="img" />
}

export function LookPage() {
  const [lookId, setLookId] = useState(LOOKS[0].id)
  const look = LOOKS.find((l) => l.id === lookId) ?? LOOKS[0]
  // The machine's colours can be swapped separately, to mix and match.
  const [machineId, setMachineId] = useState<string | null>(null)
  const shownMachine = machineId ?? look.machine
  const machine = useRef<MachineScene | null>(null)
  // In "machine colours" looks, the step numbers are coloured blocks like the machine's keys.
  const stepStyle = (i: number): CSSProperties | undefined =>
    look.rainbow
      ? { background: rows[i], color: labelOn(rows[i]), padding: '0 0.5rem', borderRadius: '6px', alignSelf: 'flex-start' }
      : look.headings
        ? { color: look.headings }
        : undefined
  // Section headings: the look's heading colour, or a category colour in "machine colours" looks.
  const headingStyle = (category: string, section: SectionColours): CSSProperties | undefined =>
    look.headings ? { color: look.headings } : look.rainbow ? { color: readable(category, section.bg, section.accent) } : undefined
  const onReady = useCallback((scene: MachineScene | null) => void (machine.current = scene), [])
  const { hero, how, examples, cta } = look.sections
  const rows = look.categories ?? defaultColours

  const vars = {
    '--btn-bg': look.button.bg,
    '--btn-text': look.button.text,
    '--btn-shadow': look.button.shadow,
  } as CSSProperties

  return (
    <div className="look" style={vars}>
      <div className="look-switch" role="group" aria-label="Site colour versions">
        {LOOKS.map((l) => (
          <button
            key={l.id}
            type="button"
            aria-pressed={l.id === lookId}
            onClick={() => {
              setLookId(l.id)
              setMachineId(null)
            }}
            title={l.note}
          >
            <span style={{ background: l.sections.hero.bg, borderColor: l.sections.hero.accent }} aria-hidden="true" />
            {l.label}
          </button>
        ))}
        <small>{look.note}</small>
        <span className="look-switch__machines" role="group" aria-label="Machine colours">
          machine:
          {THEMES.filter((t) => ['teal', 'shrimp', 'paper'].includes(t.id)).map((t) => (
            <button key={t.id} type="button" aria-pressed={t.id === shownMachine} onClick={() => setMachineId(t.id)}>
              <span style={{ background: t.body, borderColor: t.trim }} aria-hidden="true" />
              {t.label}
            </button>
          ))}
        </span>
      </div>

      <Section colours={hero} className="look-hero">
        <nav className="look-nav">
          <a href="#/look" className="look-logo">
            Floppy Thoughts
          </a>
          <a href="#/look" className="look-navlink">
            my boards
          </a>
        </nav>
        <div className="look-hero__grid">
          <div className="look-hero__text">
            <h1>
              ideas worth <span>hacking on</span>
            </h1>
            <p>A vending machine full of shrimp, each holding a random note to get you thinking. Pick a capsule, then follow the thought somewhere unexpected on your own board.</p>
            <div className="look-ctas">
              <a href="#/look" className="look-btn">
                start a board
              </a>
              <a href="#/look" className="look-btn look-btn--quiet">
                continue where I left off
              </a>
            </div>
          </div>
          <div className="look-hero__machine">
            <Machine machineId={shownMachine} categories={look.categories} onReady={onReady} />
            <div className="look-try">
              <span>
                try it: type <kbd>B2</kbd> and <kbd>Enter</kbd>, or
              </span>
              <button type="button" className="look-btn look-btn--small" onClick={() => machine.current?.vend()}>
                get a shrimp
              </button>
            </div>
          </div>
        </div>
      </Section>

      <Section colours={how} className="look-how">
        <h2 style={headingStyle(rows[0], how)}>~/how it works</h2>
        <ol className="look-steps">
          <li>
            <b style={stepStyle(0)}>1</b>
            <strong>pick a capsule</strong>
            <span>Each row of the machine is a kind of note. Type its code, or press ? for a surprise.</span>
          </li>
          <li>
            <b style={stepStyle(1)}>2</b>
            <strong>push the thought</strong>
            <span>Add your own thoughts, link them, and ask for a nudge when you&apos;re stuck: a word or a question, never an answer.</span>
          </li>
          <li>
            <b style={stepStyle(2)}>3</b>
            <strong>land on an idea</strong>
            <span>Follow one thread somewhere unexpected and mark the one you want to build. It&apos;s still your idea.</span>
          </li>
        </ol>
        <ul className="look-cats" aria-label="The rows of the machine">
          {CATEGORIES.map((c, i) => (
            <li key={c.name} style={{ background: rows[i], color: bestText(rows[i], ['#17110e', '#f6e3cc']) }}>
              <b>{LETTERS[i]}</b> {c.name}
            </li>
          ))}
        </ul>
      </Section>

      <Section colours={examples} className="look-examples">
        <h2 style={headingStyle(rows[4], examples)}>~/example boards</h2>
        <div className="look-cards">
          {EXAMPLES.map((ex) => (
            <article key={ex.idea} className="look-card">
              {ex.notes.map((n) => {
                const [code, text] = n.split(' > ')
                return (
                  <p key={n} className="look-card__note">
                    {look.rainbow || look.chips ? <Code code={code} colours={rows} /> : code} &gt; {text}
                  </p>
                )
              })}
              <p className="look-card__trail">{ex.trail}</p>
              <p className="look-card__idea">
                <span>idea</span> {ex.idea}
              </p>
            </article>
          ))}
        </div>
      </Section>

      <Section colours={cta} className="look-cta">
        <h2>404: idea not found... yet</h2>
        <a href="#/look" className="look-btn">
          start a board
        </a>
        <footer>
          <span>Floppy Thoughts · ideas worth hacking on</span>
          <span>🦐 sit up straight</span>
        </footer>
      </Section>
    </div>
  )
}
