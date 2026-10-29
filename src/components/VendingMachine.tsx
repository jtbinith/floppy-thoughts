import { useEffect, useRef, useState } from 'react'
import { CATEGORY_LABEL } from '../lib/board'
import { CONTENT_CATEGORIES, SPARKS, type ContentCategory } from '../lib/sparks/content'
import { sparkFrom, type Spark } from '../lib/sparks/deal'
import { loadSeen } from '../lib/sparks/seen'

// One cosy vending machine. Its lit window holds floppy disks, two shelves of three categories.
// Press a key (on its keypad or your keyboard) to vend: the machine hums, a disk drops into the
// tray, and its label "loads" the spark. A drawn placeholder until the real illustration.

type RowId = ContentCategory | 'surprise'

const ROWS: { id: RowId; key: string; label: string; colour: string }[] = [
  { id: 'words', key: 'W', label: 'words', colour: '#ff7a52' },
  { id: 'objects', key: 'O', label: 'objects', colour: '#f2b544' },
  { id: 'problems', key: 'P', label: 'problems', colour: '#7fb7c9' },
  { id: 'curiosities', key: 'C', label: 'curiosities', colour: '#c69ae0' },
  { id: 'nature', key: 'N', label: 'nature', colour: '#9fd46a' },
  { id: 'surprise', key: '?', label: 'surprise me', colour: '#efe7dc' },
]

const VEND_MS = 1300
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
const INK = '#2f2526'

// A little floppy disk drawn at (x, y).
function Disk({ x, y, colour, faded }: { x: number; y: number; colour: string; faded: boolean }) {
  return (
    <g transform={`translate(${x} ${y})`} opacity={faded ? 0.18 : 1}>
      <path d="M0 2 Q0 0 2 0 H17 L22 5 V20 Q22 22 20 22 H2 Q0 22 0 20 Z" fill={colour} stroke={INK} strokeWidth="1.5" />
      <rect x="5" y="1.5" width="10" height="6" rx="1" fill="#d9dce0" stroke={INK} strokeWidth="1" />
      <rect x="4" y="12" width="14" height="8" rx="1" fill="#fbf6ee" stroke={INK} strokeWidth="1" />
    </g>
  )
}

type Props = {
  coins: number
  theme?: string
  onDone: (sparks: Spark[]) => void
  onBack: () => void
}

export function VendingMachine({ coins, theme, onDone, onBack }: Props) {
  const [vended, setVended] = useState<{ row: RowId; spark: Spark }[]>([])
  const [vending, setVending] = useState<RowId | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const coinsLeft = coins - vended.length
  const done = coinsLeft === 0
  const doneRef = useRef<HTMLButtonElement>(null)

  useEffect(() => () => clearTimeout(timer.current), [])
  useEffect(() => {
    if (done) doneRef.current?.focus()
  }, [done])

  const vendedTexts = new Set(vended.map((v) => v.spark.text))
  // A row is only empty once every disk in that category has been vended.
  const rowEmpty = (row: RowId) => row !== 'surprise' && SPARKS[row].every((t) => vendedTexts.has(t))

  function vend(row: RowId) {
    if (done || vending || rowEmpty(row)) return
    // Rows can vend as often as you like; "surprise me" picks any category.
    const pool = CONTENT_CATEGORIES.filter((c) => !rowEmpty(c))
    const category: ContentCategory = row === 'surprise' ? pool[Math.floor(Math.random() * pool.length)] : row
    const spark = sparkFrom(category, loadSeen(), Math.random, vendedTexts)
    setVending(row)
    timer.current = setTimeout(
      () => {
        setVended((current) => [...current, { row, spark }])
        setVending(null)
      },
      reducedMotion() ? 0 : VEND_MS,
    )
  }

  // The physical keyboard works like the keypad.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const key = e.key === '/' ? '?' : e.key.toUpperCase()
      const row = ROWS.find((r) => r.key === key)
      if (row) {
        e.preventDefault()
        vend(row.id)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const display = done ? 'ENJOY!' : vending ? 'VENDING…' : `${coinsLeft} LEFT`
  const colourOf = (category: ContentCategory) => ROWS.find((r) => r.id === category)?.colour ?? '#ff7a52'

  return (
    <div className="vend">
      <div className={`vend__machine${vending ? ' vend__machine--vending' : ''}`}>
        <svg viewBox="0 0 320 470" className="vend__art" role="img" aria-label="A cosy vending machine full of floppy disks">
          {/* plants creeping up the sides */}
          <g fill="#7a9a5a" stroke={INK} strokeWidth="1.5">
            <ellipse cx="38" cy="120" rx="14" ry="7" transform="rotate(-35 38 120)" />
            <ellipse cx="30" cy="150" rx="16" ry="8" transform="rotate(20 30 150)" />
            <ellipse cx="44" cy="96" rx="11" ry="6" transform="rotate(-60 44 96)" />
            <ellipse cx="285" cy="380" rx="16" ry="8" transform="rotate(-25 285 380)" />
            <ellipse cx="292" cy="410" rx="14" ry="7" transform="rotate(25 292 410)" />
            <ellipse cx="60" cy="455" rx="22" ry="8" />
            <ellipse cx="262" cy="458" rx="20" ry="7" />
          </g>

          {/* sign on top, a little crooked */}
          <g transform="rotate(-3 160 34)">
            <rect x="80" y="14" width="160" height="40" rx="8" fill="#ff7a52" stroke={INK} strokeWidth="3" />
            <text x="160" y="41" textAnchor="middle" className="vend__sign">
              floppy thoughts
            </text>
          </g>

          {/* body */}
          <rect x="50" y="56" width="220" height="400" rx="16" fill="#8f8890" stroke={INK} strokeWidth="3" />
          <rect x="58" y="64" width="204" height="384" rx="12" fill="none" stroke="#a49da6" strokeWidth="2" />

          {/* the lit window with two shelves */}
          <rect x="70" y="80" width="124" height="200" rx="6" fill="#f6c46c" stroke={INK} strokeWidth="3" />
          <rect x="76" y="86" width="112" height="188" rx="4" fill="#fbd68e" opacity="0.5" />
          {[0, 1].map((shelf) => (
            <g key={shelf}>
              <rect x="74" y={160 + shelf * 90} width="116" height="7" rx="2" fill="#c98b3a" stroke={INK} strokeWidth="1.5" />
              {ROWS.slice(shelf * 3, shelf * 3 + 3).map((row, i) => {
                const used = rowEmpty(row.id)
                const x = 77 + i * 38
                const y = 108 + shelf * 90
                return (
                  <g key={row.id} className={vending === row.id ? 'vend__wobble' : undefined}>
                    <Disk x={x} y={y + 12} colour={row.colour} faded={used} />
                    <Disk x={x + 8} y={y + 4} colour={row.colour} faded={used} />
                    <rect x={x + 4} y={y + 44} width="22" height="11" rx="2" fill="#fbf6ee" stroke={INK} strokeWidth="1" />
                    <text x={x + 15} y={y + 53} textAnchor="middle" className="vend__price">
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

          {/* display window showing a disk, then the pickup slot */}
          <rect x="70" y="296" width="124" height="70" rx="8" fill="#5f5960" stroke={INK} strokeWidth="2.5" />
          <g transform="translate(111 309) scale(1.9)">
            <path d="M0 2 Q0 0 2 0 H17 L22 5 V20 Q22 22 20 22 H2 Q0 22 0 20 Z" fill="#efe7dc" stroke={INK} strokeWidth="1" />
            <rect x="5" y="1.5" width="10" height="6" rx="1" fill="#d9dce0" />
          </g>
          <rect x="80" y="386" width="160" height="36" rx="6" fill="#4b454c" stroke={INK} strokeWidth="2.5" />
          <rect x="88" y="392" width="144" height="10" rx="3" fill="#2f2a30" />

          {/* a coin-return button and a tiny maker's mark */}
          <circle cx="240" cy="330" r="7" fill="#c9c3cb" stroke={INK} strokeWidth="2" />
          <text x="246" y="440" textAnchor="end" className="vend__mark">
            🦐 floppy &amp; co.
          </text>
        </svg>

        {/* Screen text and keypad sit over the drawing's side panel. */}
        <div className="vend__screen" aria-live="polite">
          {display}
        </div>
        <div className="vend__keys">
          {ROWS.map((row) => {
            const used = rowEmpty(row.id)
            return (
              <button
                key={row.id}
                type="button"
                className="vend__key"
                onClick={() => vend(row.id)}
                disabled={done || used || !!vending}
                title={row.label}
                aria-label={`${row.label} (key ${row.key})${used ? ', empty' : ''}`}
              >
                {row.key}
              </button>
            )
          })}
        </div>
      </div>

      <div className="vend__out">
        <p className="vend__intro">
          {done ? 'Your disks are ready.' : (
            <>
              Press a key to vend a disk: <kbd>W</kbd> words · <kbd>O</kbd> objects · <kbd>P</kbd> problems · <kbd>C</kbd>{' '}
              curiosities · <kbd>N</kbd> nature · <kbd>?</kbd> surprise me
            </>
          )}
        </p>

        {/* Disks land here and load their spark. */}
        <ol className="vend__tray" aria-live="polite">
          {theme && (
            <li className="disk disk--loaded" style={{ ['--disk' as string]: '#f6e3cc' }}>
              <span className="disk__shutter" aria-hidden="true" />
              <span className="disk__label">
                <small>~/theme</small>
                {theme}
              </span>
            </li>
          )}
          {vended.map(({ spark }) => (
            <li key={spark.text} className="disk disk--loaded" style={{ ['--disk' as string]: colourOf(spark.category as ContentCategory) }}>
              <span className="disk__shutter" aria-hidden="true" />
              <span className="disk__label">
                <small>~/{CATEGORY_LABEL[spark.category]}</small>
                {spark.text}
              </span>
            </li>
          ))}
          {Array.from({ length: coinsLeft }, (_, i) => (
            <li key={`empty-${i}`} className="disk disk--slot" aria-hidden="true" />
          ))}
        </ol>

        <div className="start__actions">
          <button ref={doneRef} type="button" className="start__deal" disabled={!done} onClick={() => onDone(vended.map((v) => v.spark))}>
            open my board →
          </button>
          <button type="button" className="start__cancel" onClick={onBack}>
            back
          </button>
        </div>
      </div>
    </div>
  )
}
