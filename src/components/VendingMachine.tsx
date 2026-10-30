import type { KeyboardEvent } from 'react'
import type { Spark } from '../lib/sparks/deal'
import { loadSeen } from '../lib/sparks/seen'
import { rowEmpty, vendNote, type VendRow } from '../lib/sparks/vend'
import { ROWS } from './vendColours'

// One cosy vending machine, in the drawer beside the board. Its lit window holds capsules,
// each with a curled-up shrimp inside. Press a key (on its keypad, or your keyboard while the
// drawer has focus) and a capsule comes out: the popup over the board shows it opening.
// A drawn placeholder until the real illustration.

const INK = '#2f2526'
const SHRIMP = '#ff8f6b'

// A little capsule on the shelf: a tinted see-through top, a solid base, and a curled shrimp inside.
function Capsule({ x, y, colour, faded }: { x: number; y: number; colour: string; faded: boolean }) {
  return (
    <g transform={`translate(${x} ${y})`} opacity={faded ? 0.18 : 1}>
      <path d="M1 11 A10 10 0 0 1 21 11 Z" fill={colour} fillOpacity="0.35" stroke={INK} strokeWidth="1.5" />
      <path d="M5 9 Q5.5 4 11 3.5" fill="none" stroke="#fff" strokeWidth="1.3" opacity="0.6" />
      <path d="M7.5 10 A4 4 0 1 1 15 10" fill="none" stroke={SHRIMP} strokeWidth="2.6" strokeLinecap="round" />
      <path d="M1 11 H21 A10 10 0 0 1 1 11 Z" fill={colour} stroke={INK} strokeWidth="1.5" />
    </g>
  )
}

type Props = {
  // Texts already on the board, so the machine never hands you a repeat.
  onBoard: ReadonlySet<string>
  onVend: (note: Spark) => void
  // While a note is out (the popup is showing), the machine waits.
  busy: boolean
}

export function VendingMachine({ onBoard, onVend, busy }: Props) {

  function vend(row: VendRow) {
    if (busy) return
    const note = vendNote(row, onBoard, { seen: loadSeen() })
    if (note) onVend(note)
  }

  // Your keyboard works like the keypad while the drawer has focus.
  function handleKey(e: KeyboardEvent) {
    if (e.ctrlKey || e.metaKey || e.altKey || (e.target as Element).closest('input, textarea')) return
    const key = e.key === '/' ? '?' : e.key.toUpperCase()
    const row = ROWS.find((r) => r.key === key)
    if (row) {
      e.preventDefault()
      vend(row.id)
    }
  }

  const display = busy ? 'ENJOY!' : 'PICK ONE'

  return (
    <div className="vend" onKeyDown={handleKey}>
      <div className="vend__machine">
        <svg viewBox="0 0 320 400" className="vend__art" role="img" aria-label="A cosy vending machine full of shrimp capsules">
          {/* plants creeping up the sides */}
          <g fill="#7a9a5a" stroke={INK} strokeWidth="1.5">
            <ellipse cx="38" cy="120" rx="14" ry="7" transform="rotate(-35 38 120)" />
            <ellipse cx="30" cy="150" rx="16" ry="8" transform="rotate(20 30 150)" />
            <ellipse cx="44" cy="96" rx="11" ry="6" transform="rotate(-60 44 96)" />
            <ellipse cx="285" cy="330" rx="16" ry="8" transform="rotate(-25 285 330)" />
            <ellipse cx="292" cy="360" rx="14" ry="7" transform="rotate(25 292 360)" />
            <ellipse cx="60" cy="388" rx="22" ry="8" />
            <ellipse cx="262" cy="390" rx="20" ry="7" />
          </g>

          {/* sign on top, a little crooked */}
          <g transform="rotate(-3 160 34)">
            <rect x="80" y="14" width="160" height="40" rx="8" fill="#ff7a52" stroke={INK} strokeWidth="3" />
            <text x="160" y="41" textAnchor="middle" className="vend__sign">
              floppy thoughts
            </text>
          </g>

          {/* body */}
          <rect x="50" y="56" width="220" height="334" rx="16" fill="#8f8890" stroke={INK} strokeWidth="3" />
          <rect x="58" y="64" width="204" height="318" rx="12" fill="none" stroke="#a49da6" strokeWidth="2" />

          {/* the lit window with two shelves of capsules */}
          <rect x="70" y="80" width="124" height="200" rx="6" fill="#f6c46c" stroke={INK} strokeWidth="3" />
          <rect x="76" y="86" width="112" height="188" rx="4" fill="#fbd68e" opacity="0.5" />
          {[0, 1].map((shelf) => (
            <g key={shelf}>
              <rect x="74" y={160 + shelf * 90} width="116" height="7" rx="2" fill="#c98b3a" stroke={INK} strokeWidth="1.5" />
              {ROWS.slice(shelf * 3, shelf * 3 + 3).map((row, i) => {
                const empty = rowEmpty(row.id, onBoard)
                const x = 78 + i * 38
                const y = 108 + shelf * 90
                return (
                  <g key={row.id}>
                    <Capsule x={x} y={y + 18} colour={row.colour} faded={empty} />
                    <Capsule x={x + 7} y={y + 2} colour={row.colour} faded={empty} />
                    <rect x={x + 3} y={y + 44} width="22" height="11" rx="2" fill="#fbf6ee" stroke={INK} strokeWidth="1" />
                    <text x={x + 14} y={y + 53} textAnchor="middle" className="vend__price">
                      {row.key}
                    </text>
                  </g>
                )
              })}
            </g>
          ))}
          {/* glass shine */}
          <path d="M84 90 L110 90 L84 140 Z" fill="#fff" opacity="0.25" />

          {/* side panel: little screen and coin slot (the real keys are buttons laid over it) */}
          <rect x="202" y="80" width="56" height="200" rx="5" fill="#a49da6" stroke={INK} strokeWidth="2" />
          <rect x="207" y="88" width="46" height="20" rx="2" fill="#1d2b1a" stroke={INK} strokeWidth="1.5" />
          <rect x="225" y="252" width="10" height="20" rx="2" fill={INK} />

          {/* the pickup flap */}
          <rect x="80" y="300" width="160" height="40" rx="6" fill="#4b454c" stroke={INK} strokeWidth="2.5" />
          <rect x="88" y="306" width="144" height="12" rx="3" fill="#2f2a30" />

          {/* a tiny maker's mark */}
          <text x="246" y="372" textAnchor="end" className="vend__mark">
            🦐 floppy &amp; co.
          </text>
        </svg>

        {/* Screen text and keypad sit over the drawing's side panel. */}
        <div className="vend__screen" aria-live="polite">
          {display}
        </div>
        <div className="vend__keys">
          {ROWS.map((row) => {
            const empty = rowEmpty(row.id, onBoard)
            return (
              <button
                key={row.id}
                type="button"
                className="vend__key"
                onClick={() => vend(row.id)}
                disabled={empty || busy}
                title={row.label}
                aria-label={`${row.label} (key ${row.key})${empty ? ', empty' : ''}`}
              >
                {row.key}
              </button>
            )
          })}
        </div>
      </div>

      <p className="vend__intro">
        <kbd>W</kbd> words · <kbd>O</kbd> objects · <kbd>P</kbd> problems · <kbd>C</kbd> curiosities · <kbd>N</kbd> nature · <kbd>?</kbd>{' '}
        surprise me
      </p>

    </div>
  )
}
