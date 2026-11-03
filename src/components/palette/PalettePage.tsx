import { useState } from 'react'
import { bestText, contrast, luminance, rate } from '../../lib/contrast'
import { BACKGROUNDS, CATEGORY_COLOURS, PALETTE, SOURCES, TEXTS, type Swatch } from './palette'
import { ThemeToggle } from '../ThemeToggle'

// PROTOTYPE: a page for designing the site's colours: where they came from, the proposed palette,
// how well text reads on each colour, and the palette blocked out into real-looking UI.
// Lives at #/palette.

const INK = '#2b1d18'
const CREAM = '#f6eedd'
// The more readable of our two text colours on any background.
const textOn = (bg: string) => bestText(bg, [CREAM, INK])

function Chip({ swatch, big = false, note }: { swatch: Swatch; big?: boolean; note?: string }) {
  return (
    <figure className={`pal-chip${big ? ' pal-chip--big' : ''}`} style={{ background: swatch.hex, color: textOn(swatch.hex) }}>
      <strong>{swatch.name}</strong>
      <code>
        {swatch.hex} · L {Math.round(luminance(swatch.hex) * 100)}
      </code>
      {note && <small>{note}</small>}
    </figure>
  )
}

export function PalettePage() {
  const [grey, setGrey] = useState(false)
  return (
    <div className={`pal${grey ? ' pal--grey' : ''}`}>
      <button type="button" className="pal-grey" aria-pressed={grey} onClick={() => setGrey((g) => !g)}>
        {grey ? 'back to colour' : 'see in greyscale'}
      </button>
      <ThemeToggle className="pal-theme" />
      <header className="pal__head">
        <h1>
          colour <span>palette</span>
        </h1>
        <p>
          Shrimp × tech: the site&apos;s colours in dark and light mode (switch with the sun/moon button), from the references below. Everything here comes from
          one list of colours.{' '}
          <b>L</b> is how bright a colour is (0 black to 100 white): colours with close L values look the same in greyscale.
        </p>
      </header>

      <section>
        <h2>~/where it came from</h2>
        <div className="pal-sources">
          {SOURCES.map((s) => (
            <div key={s.title} className="pal-source">
              <h3>{s.title}</h3>
              <p>{s.note}</p>
              <div className="pal-strip">
                {s.swatches.map((sw) => (
                  <span key={sw.hex + sw.name} style={{ background: sw.hex }} title={`${sw.name} ${sw.hex}`} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2>~/the palette</h2>
        {PALETTE.map((g) => (
          <div key={g.group} className="pal-group">
            <h3>{g.group}</h3>
            <div className="pal-chips">
              {g.roles.map((r) => (
                <Chip key={r.name} swatch={r} big note={r.use} />
              ))}
            </div>
          </div>
        ))}
        <div className="pal-group">
          <h3>machine categories</h3>
          <div className="pal-chips">
            {CATEGORY_COLOURS.map((c) => (
              <Chip key={c.name} swatch={c} />
            ))}
          </div>
        </div>
      </section>

      <section>
        <h2>~/contrast</h2>
        <p className="pal-note">
          How readable each text colour is on each background (WCAG). <b>AAA</b> (7+) and <b>AA</b> (4.5+) are fine for any text; <b>large</b> (3+) only for big or
          bold text and icons; <b>fail</b> is too faint.
        </p>
        <div className="pal-table-wrap">
          <table className="pal-table">
            <thead>
              <tr>
                <th>text ↓ / background →</th>
                {BACKGROUNDS.map((b) => (
                  <th key={b.name}>{b.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {TEXTS.map((t) => (
                <tr key={t.name}>
                  <th>{t.name}</th>
                  {BACKGROUNDS.map((b) => {
                    const ratio = contrast(t.hex, b.hex)
                    const r = rate(ratio)
                    return (
                      <td key={b.name} style={{ background: b.hex, color: t.hex }} className={`pal-cell pal-cell--${r}`}>
                        <span className="pal-cell__aa">Aa</span>
                        <span className="pal-cell__score" style={{ color: textOn(b.hex) }}>
                          {ratio.toFixed(1)} · {r}
                        </span>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2>~/colour blocking</h2>
        <p className="pal-note">The palette laid out as big blocks of colour, to judge the balance and the mood.</p>

        <div className="pal-hero">
          <div className="pal-hero__main">
            <h3>
              ideas worth <span>hacking on</span>
            </h3>
            <p>A brainstorming board for your own thoughts, with a vending machine full of shrimp when you want a push.</p>
            <div className="pal-buttons">
              <button type="button" className="pal-btn pal-btn--primary">
                start a board
              </button>
              <button type="button" className="pal-btn pal-btn--secondary">
                continue where I left off
              </button>
              <a href="#/palette" className="pal-link">
                a link
              </a>
            </div>
          </div>
          <div className="pal-hero__teal">404: idea not found...yet</div>
          <div className="pal-hero__amber">✓ this is the one</div>
          <div className="pal-hero__plum">♥ favourites</div>
        </div>

        <div className="pal-blocks">
          {CATEGORY_COLOURS.map((r) => (
            <article key={r.name} className="pal-card" style={{ background: r.hex, color: textOn(r.hex) }}>
              <small>~/{r.name.slice(2)}</small>
              <strong>a kettle that sings</strong>
              <p>who is it singing to?</p>
            </article>
          ))}
        </div>

        <div className="pal-light">
          <h3>light section</h3>
          <p>
            Terminal paper with ink text, for paper-like parts such as notes and the summary, even in dark mode. <a href="#/palette">A link</a> and a{' '}
            <mark>highlight</mark>.
          </p>
          <div className="pal-buttons">
            <button type="button" className="pal-btn pal-btn--ink">
              primary on paper
            </button>
            <button type="button" className="pal-btn pal-btn--outline-ink">
              secondary on paper
            </button>
          </div>
        </div>

        <div className="pal-board">
          <span className="pal-box" style={{ borderColor: '#d2452f' }}>
            <b style={{ background: '#d2452f', color: CREAM }}>~/word</b>
            <span>&gt; cassette</span>
          </span>
          <span className="pal-box" style={{ borderColor: '#23726c' }}>
            <b style={{ background: '#23726c', color: CREAM }}>~/problem</b>
            <span>&gt; plants die while I&apos;m away</span>
          </span>
          <span className="pal-box">
            <span>mixtapes for plants?</span>
          </span>
          <span className="pal-box pal-box--chosen">
            <span>a light that pulses when thirsty</span>
          </span>
        </div>
      </section>
    </div>
  )
}
