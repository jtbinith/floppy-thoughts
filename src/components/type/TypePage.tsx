import { ThemeToggle } from '../ThemeToggle'

// PROTOTYPE: choosing the site's type. The fonts already chosen, and accent font ideas for one
// special place.
// Lives at #/type.

type Font = { family: string; label: string; licence: string }

// Round two: signage, neon, display serifs and chunky friendly shapes (round one, pixel / glitch /
// handwriting, wasn't the feel).
const ACCENTS: (Font & { why: string; italic?: boolean })[] = [
  { family: "'Bungee'", label: 'Bungee', licence: 'Google Fonts · Open Font Licence', why: 'made for signs, like the label on a vending machine' },
  { family: "'Bungee Shade'", label: 'Bungee Shade', licence: 'Google Fonts · Open Font Licence', why: 'the same sign letters with a 3D shadow, like the 3D machine' },
  { family: "'Monoton'", label: 'Monoton', licence: 'Google Fonts · Open Font Licence', why: 'neon tubes, like a lit-up shop sign at night' },
  { family: "'Rampart One'", label: 'Rampart One', licence: 'Google Fonts · Open Font Licence', why: 'puffy outlined letters, like a toy or a sticker' },
  { family: "'Bagel Fat One'", label: 'Bagel Fat One', licence: 'Google Fonts · Open Font Licence', why: 'fat and round, squishy like a shrimp' },
  { family: "'Shrikhand'", label: 'Shrikhand', licence: 'Google Fonts · Open Font Licence', why: 'bold, curly retro italic, like a diner sign' },
  { family: "'Fraunces'", label: 'Fraunces (italic)', licence: 'Google Fonts · Open Font Licence', why: 'a soft, wonky serif, more bookish and warm', italic: true },
  { family: "'Rubik Mono One'", label: 'Rubik Mono One', licence: 'Google Fonts · Open Font Licence', why: 'heavy, wide, rounded capitals, like arcade cabinet lettering' },
]

export function TypePage() {
  return (
    <div className="ty">
      <ThemeToggle className="ty-theme" />
      <header className="ty__head">
        <p className="ty-eyebrow">~/type</p>
        <h1>type</h1>
        <p>
          Headings are Bungee and reading text stays Atkinson Hyperlegible; the terminal font is for
          section titles, capsule codes and hints. An accent font would be used in one special place only. Switch dark/light with the sun/moon button.
        </p>
      </header>

      <section className="ty-section">
        <h2>chosen</h2>
        <div className="ty-chosen">
          <span>terminal: Courier Prime</span>
          <span>headline cursor: underscore _</span>
          <span>headings and signs: Bungee</span>
          <span>reading: Atkinson Hyperlegible</span>
        </div>
      </section>

      <section className="ty-section">
        <h2>accent font ideas</h2>
        <p className="ty-note">Shown on the closing band of the home page. It could also go on the “idea” tag on example boards, or the graffiti on the machine.</p>
        <div className="ty-accents">
          {ACCENTS.map((f) => (
            <article key={f.label} className={`ty-accent${f.italic ? ' ty-accent--italic' : ''}`} style={{ ['--trial' as string]: f.family }}>
              <p className="ty-accent__big">404: idea not found... yet</p>
              <p className="ty-accent__tag">
                <span>idea</span> a plant sensor that blinks like a firefly
              </p>
              <footer>
                <strong>{f.label}</strong> · {f.why}
                <small>{f.licence}</small>
              </footer>
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}
