import { ThemeToggle } from '../ThemeToggle'

// PROTOTYPE: ways for the note to come out of the cracked shrimp token, side by side, all with
// the same note. Lives at #/notes. Each says how it would animate.

const NOTE = { label: 'curiosity', text: 'Sharks existed before trees', colour: 'var(--cat-curiosities)' }

function Terminal() {
  return (
    <div className="nt-term">
      <div className="nt-term__bar">
        <i />
        <i />
        <i />
        <span>~/notes — zsh</span>
      </div>
      <div className="nt-term__body">
        <p className="nt-dim">% cat {NOTE.label}.txt</p>
        <p className="nt-term__note">{NOTE.text}</p>
        <p className="nt-dim">
          % <span className="nt-key">⏎</span> stick on board · <span className="nt-key">esc</span> put back<i className="nt-caret" />
        </p>
      </div>
    </div>
  )
}

function Bevel() {
  return (
    <div className="nt-bevel">
      <div className="nt-bevel__bar">
        <span>New note: {NOTE.label}</span>
        <b aria-hidden="true">×</b>
      </div>
      <div className="nt-bevel__body">
        <span className="nt-bevel__icon" aria-hidden="true">🦐</span>
        <p>{NOTE.text}</p>
      </div>
      <div className="nt-bevel__actions">
        <button type="button">Stick on board</button>
        <button type="button">Put back</button>
      </div>
    </div>
  )
}

function Receipt() {
  return (
    <div className="nt-receipt">
      <div className="nt-receipt__slot" />
      <div className="nt-receipt__paper">
        <p className="nt-receipt__head">FLOPPY THOUGHTS</p>
        <p className="nt-dim">row D · {NOTE.label}</p>
        <p className="nt-receipt__rule">- - - - - - - - - - - -</p>
        <p className="nt-receipt__note">{NOTE.text}</p>
        <p className="nt-receipt__rule">- - - - - - - - - - - -</p>
        <p className="nt-dim">⏎ stick it · esc put back</p>
      </div>
    </div>
  )
}

function Hologram() {
  return (
    <div className="nt-holo" style={{ ['--holo' as string]: NOTE.colour }}>
      <div className="nt-holo__panel">
        <small>~/{NOTE.label}</small>
        <p>{NOTE.text}</p>
        <div className="nt-holo__actions">
          <span>[⏎] stick</span>
          <span>[esc] put back</span>
        </div>
      </div>
      <div className="nt-holo__beam" />
      <div className="nt-holo__base">token</div>
    </div>
  )
}

function Led() {
  return (
    <div className="nt-led">
      <div className="nt-led__screen">
        <p>{NOTE.text.toUpperCase()}</p>
      </div>
      <div className="nt-led__actions">
        <button type="button">stick it on the board</button>
        <button type="button">put it back</button>
      </div>
    </div>
  )
}

// Round two: built from parts the site already has.

// Exactly the note box that lands on the board (the board's own classes), with its tool buttons.
function BoardNote({ id = '7' }: { id?: string }) {
  return (
    <div className="idea idea--spark idea--cat-curiosities nt-boardnote">
      <span className="idea__meta">
        <span className="idea__category">curiosity</span>
        <span className="idea__id">{id}</span>
      </span>
      <span className="idea__text">{NOTE.text}</span>
    </div>
  )
}

function Tools() {
  return (
    <span className="idea__tools nt-tools">
      <button type="button" className="idea__tool nt-tool--go">
        ⏎ stick on board
      </button>
      <button type="button" className="idea__tool">
        esc put back
      </button>
    </span>
  )
}

function NoteBox() {
  return (
    <div className="nt-col">
      <BoardNote />
      <Tools />
    </div>
  )
}

// A tiny Floppy Thoughts: the circuit-teal frame with screws, a screen with the terminal's
// title strip and prompt, and the note box underneath, as if the machine ran /vend.
function MiniDevice() {
  return (
    <div className="nt-device">
      {(['tl', 'tr', 'bl', 'br'] as const).map((c) => (
        <span key={c} className={`device__screw device__screw--${c}`} aria-hidden="true" />
      ))}
      <div className="nt-device__screen">
        <div className="terminal__title">TERMINAL</div>
        <div className="nt-device__log">
          <p className="terminal__line terminal__line--input">~ % /vend D</p>
          <BoardNote />
          <p className="terminal__line">
            ~ % <span className="nt-dim">⏎ stick · esc put back</span>
            <i className="nt-caret" />
          </p>
        </div>
      </div>
    </div>
  )
}

// The board's terminal panel itself, printing what came out.
function TerminalPanel() {
  return (
    <div className="nt-panel">
      <div className="terminal__title">TERMINAL</div>
      <div className="nt-panel__log">
        <p className="terminal__line terminal__line--input">&gt; /vend D</p>
        <p className="terminal__line">a shrimp cracked open…</p>
        <p className="terminal__line nt-panel__note">
          <b>~/curiosity</b> {NOTE.text}
        </p>
        <p className="terminal__line">
          ~ % <span className="nt-dim">⏎ stick on board · esc put back</span>
          <i className="nt-caret" />
        </p>
      </div>
    </div>
  )
}

const CONNECTED = [
  { id: 'note', title: 'A · the board note itself', node: <NoteBox />, how: 'The note comes out as the exact box it’ll be on the board (header in the row colour, “> ” text), with the board’s own tool buttons. Pops out of the crack and grows to size. Stick it, and that same box flies onto the board.' },
  { id: 'device', title: 'B · a tiny Floppy Thoughts', node: <MiniDevice />, how: 'A mini version of the board’s device: circuit-teal frame with screws, the TERMINAL strip, the /vend command typing itself, then the note box. Like the machine has its own little screen.' },
  { id: 'panel', title: 'C · the terminal panel', node: <TerminalPanel />, how: 'The board’s terminal panel, printing what came out as lines (the note in its row colour), with the blinking underscore. The simplest, most “developer” option.' },
]

const OPTIONS = [
  { id: 'terminal', title: '1 · mini terminal', node: <Terminal />, how: 'A little terminal window pops out of the crack and the note types itself out, with the blinking underscore. Matches the board’s terminal. Keys shown as hints.' },
  { id: 'bevel', title: '2 · retro bevel window', node: <Bevel />, how: 'An old-computer dialog box (chunky bevels, title bar) zooms out of the crack like a window opening. Playful, very "computer", but a different style from the rest of the site.' },
  { id: 'receipt', title: '3 · receipt printer', node: <Receipt />, how: 'The token’s crack is a printer slot: a thermal receipt prints out line by line, with a little jitter. Vending machines print receipts, so it fits the machine; tech, but still paper.' },
  { id: 'holo', title: '4 · hologram', node: <Hologram />, how: 'A beam shines up from the cracked token and the note flickers in as a glowing projection in the row’s colour, with scanlines. Sci-fi tech; most magical.' },
  { id: 'led', title: '5 · LED panel', node: <Led />, how: 'The note scrolls across a small dot-matrix panel, like the sign on top of the machine. Very on-theme, but long notes have to scroll, which is slower to read.' },
]

export function NotesPage() {
  return (
    <div className="nt">
      <ThemeToggle className="nt-theme" />
      <header className="nt__head">
        <p className="nt-eyebrow">~/notes</p>
        <h1>how the note comes out</h1>
        <p>Five tech-flavoured ways for the note to appear when the shrimp token cracks open. Same note in each. Switch dark/light with the sun/moon button.</p>
      </header>
      <h2 className="nt-round">connected to what's already there</h2>
      <div className="nt-grid">
        {CONNECTED.map((o) => (
          <section key={o.id} className="nt-card">
            <h2>{o.title}</h2>
            <div className="nt-stage">{o.node}</div>
            <p className="nt-how">{o.how}</p>
          </section>
        ))}
      </div>
      <h2 className="nt-round">first round</h2>
      <div className="nt-grid">
        {OPTIONS.map((o) => (
          <section key={o.id} className="nt-card">
            <h2>{o.title}</h2>
            <div className="nt-stage">{o.node}</div>
            <p className="nt-how">{o.how}</p>
          </section>
        ))}
      </div>
    </div>
  )
}
