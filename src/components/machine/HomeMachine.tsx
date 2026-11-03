import { useEffect, useRef, useState } from 'react'
import { CATEGORY_LABEL } from '../../lib/board'
import { KEYS } from '../../lib/keys'
import type { Spark } from '../../lib/sparks/deal'
import { loadSeen, rememberSeen } from '../../lib/sparks/seen'
import { vendNote, type VendRow } from '../../lib/sparks/vend'
import { CATEGORIES } from './categories'
import { createMachineScene, type MachineScene } from './scene'
import { THEMES } from './themes'

// The live 3D vending machine: circuit teal, on a see-through background so it sits on the page in
// dark or light mode. Used on the home page and in the board's drawer. Loaded on its own, so the 3D
// library only downloads where it's shown.

// What the board's terminal can do with the machine: vend from a row (or a surprise), and act on
// the note that's out. Each returns what to print.
export type MachineControl = {
  vend: (category: string | undefined) => void
  note: (action: 'swap' | 'stick' | 'back') => string | null
}

// Where a stuck note will land on the board: its spot on the board, its top-left on screen, the
// board's zoom, and whether the board had to glide to show it.
export type NoteLanding = { at: { x: number; y: number }; left: number; top: number; zoom: number; inView: boolean }

type Props = {
  // On a board: the machine only hears keys while it has focus, asks before each vend, gets the
  // note from the board (never one already on it), and hands it back when you stick it on.
  onBoard?: {
    vendGate: (category: string) => string | null
    pickNote: (category: string) => Spark | null
    onStick: (note: Spark, at?: { x: number; y: number }) => void
    landing?: () => NoteLanding
    onPutBack: () => void
    // Handed the machine's controls (or null when it goes), for the board's terminal.
    onControl?: (control: MachineControl | null) => void
  }
  className?: string
}

export default function HomeMachine({ onBoard, className = '' }: Props) {
  const stage = useRef<HTMLDivElement>(null)
  const bubble = useRef<HTMLButtonElement>(null)
  const noteBox = useRef<HTMLDivElement>(null)
  // The note out of the machine, until you deal with it.
  const [note, setNote] = useState<Spark | null>(null)
  const noteOut = useRef(false)
  useEffect(() => void (noteOut.current = !!note), [note])
  const [machine, setMachine] = useState<MachineScene | null>(null)
  // The latest board callbacks, read when the machine needs them (it's only built once).
  const board = useRef(onBoard)
  useEffect(() => void (board.current = onBoard))
  const onABoard = !!onBoard
  useEffect(() => {
    const el = stage.current
    if (!el) return
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let scene: MachineScene | null = null
    let live = true
    // The machine's row letters (Bungee) and keys (Courier Prime) are drawn as pictures, so wait for the fonts first.
    Promise.all([document.fonts.load('96px Bungee'), document.fonts.load('bold 52px "Courier Prime"')])
      .catch(() => undefined)
      .then(() => {
        if (!live) return
        // The keypad's speech bubble follows the keypad around as the machine turns.
        const onKeypad = ({ x, y, visible }: { x: number; y: number; visible: boolean }) => {
          const b = bubble.current
          if (!b) return
          // Point from the left of the keypad instead if the bubble would run off the right edge.
          const left = x + 4 + b.offsetWidth > el.clientWidth - 4
          b.classList.toggle('home__bubble--left', left)
          b.style.transform = `translate(${Math.round(left ? x - 4 - b.offsetWidth : x + 4)}px, calc(${Math.round(y) - 14}px - 100%))`
          b.dataset.visible = String(visible)
          b.tabIndex = visible ? 0 : -1
        }
        // The note sits just above the cracked-open token, kept inside the machine's space.
        const onToken = ({ x, y, visible }: { x: number; y: number; visible: boolean }) => {
          const s = noteBox.current
          if (!s || !visible) return
          const left = Math.min(Math.max(x - s.offsetWidth / 2, 6), el.clientWidth - s.offsetWidth - 6)
          const top = Math.max(y - s.offsetHeight - 4, 6)
          s.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`
          // How far it rises from the crack.
          s.style.setProperty('--rise', `${Math.round(y - top)}px`)
          // …and from the crack's left-right spot, even when it's pushed in from an edge.
          s.style.setProperty('--crack-x', `${Math.round(x - left)}px`)
        }
        // The token has cracked open: out comes a note from that row.
        const onOpened = (category: string) => {
          const picked = board.current ? board.current.pickNote(category) : vendNote(category as VendRow, new Set(), { seen: loadSeen() })
          if (!board.current && picked) rememberSeen([picked.text])
          setNote(picked)
        }
        scene = createMachineScene(el, {
          reducedMotion,
          theme: THEMES[0],
          embedded: true,
          onKeypad,
          onToken,
          onOpened,
          // One note at a time: the screen says WAIT while one is out.
          vendGate: (category: string) => (noteOut.current ? 'WAIT' : (board.current?.vendGate(category) ?? null)),
          ...(onABoard ? { keyTarget: el } : {}),
        })
        setMachine(scene)
      })
    return () => {
      live = false
      setMachine(null)
      scene?.dispose()
    }
  }, [onABoard])
  // Done with the note: the token closes up and everything tidies away.
  const finish = () => {
    setNote(null)
    machine?.closeNote()
  }
  // Sticking it: the box slides off towards the board, then lands there.
  const [leaving, setLeaving] = useState(false)
  // Sticking it: a copy of the note box flies over everything, out of the drawer and onto the
  // exact spot (and size) the note will have on the board, then the real note takes its place.
  const stick = () => {
    if (!note || leaving) return
    const going = note
    const from = noteBox.current?.querySelector<HTMLElement>('.vended__note')
    const landing = board.current?.landing
    if (!from || !landing || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      board.current?.onStick(going)
      return finish()
    }
    setLeaving(true)
    const fly = (target: NoteLanding) => {
      const start = from.getBoundingClientRect()
      // The copy is sized like a note on the board (at zoom 1), then scaled to fit where it starts.
      const flyer = from.cloneNode(true) as HTMLElement
      flyer.classList.remove('vended__note')
      flyer.classList.add('vended__flyer')
      document.body.append(flyer)
      const s0 = start.width / flyer.offsetWidth
      const mid = { x: (start.left + target.left) / 2, y: Math.min(start.top, target.top) - 70 }
      flyer
        .animate(
          [
            { transform: `translate(${start.left}px, ${start.top}px) scale(${s0})` },
            { transform: `translate(${mid.x}px, ${mid.y}px) rotate(-3deg) scale(${(s0 + target.zoom) / 2 + 0.06})`, offset: 0.55 },
            { transform: `translate(${target.left}px, ${target.top}px) scale(${target.zoom})` },
          ],
          { duration: 560, easing: 'cubic-bezier(0.45, 0, 0.2, 1)', fill: 'forwards' },
        )
        .finished.catch(() => undefined)
        .finally(() => {
          // The real note goes down first, then the copy goes a frame later, so nothing flickers.
          board.current?.onStick(going, target.at)
          setLeaving(false)
          finish()
          requestAnimationFrame(() => requestAnimationFrame(() => flyer.remove()))
        })
    }
    const first = landing()
    // If the board had to glide to show the spot, wait for it, then ask where that is now.
    if (first.inView) fly(first)
    else window.setTimeout(() => fly(landing()), 380)
  }
  // Another note from the same row (never one already on the board).
  const swap = () => {
    if (!note) return
    const others = (category: string) => {
      for (let i = 0; i < 8; i++) {
        const next = board.current ? board.current.pickNote(category) : vendNote(category as VendRow, new Set([note.text]), { seen: loadSeen() })
        if (next && next.text !== note.text) return next
      }
      return null
    }
    const next = others(note.category)
    if (next) {
      if (!board.current) rememberSeen([next.text])
      setNote(next)
    }
  }
  const putBack = () => {
    board.current?.onPutBack()
    finish()
  }
  // From the home page: start a new board with this note already on it.
  const startBoard = () => {
    if (!note) return
    sessionStorage.setItem(KEYS.startNote, JSON.stringify(note))
    finish()
    location.hash = '/new'
  }

  // When a note comes out, focus its main button, but only if you were using the machine (on a
  // board you might be typing /stick in the terminal instead). On the home page, always.
  const wrap = useRef<HTMLDivElement>(null)
  const noteText = note?.text
  useEffect(() => {
    if (!noteText) return
    const usingMachine = !onABoard || wrap.current?.contains(document.activeElement)
    if (usingMachine) wrap.current?.querySelector<HTMLButtonElement>('.vended__go')?.focus()
  }, [noteText, onABoard])

  // For the board's terminal: /vend runs this machine, then /swap, /stick and /back.
  useEffect(() => {
    const hand = onBoard?.onControl
    // Only once the 3D machine is ready, so a /vend waits for it rather than doing nothing.
    if (!hand || !machine) return
    hand({
      vend: (category) => {
        const row = CATEGORIES.findIndex((c) => c.name === category)
        machine?.vend(row >= 0 ? String.fromCharCode(65 + row) : undefined)
      },
      note: (action) => {
        if (!note) return null
        if (action === 'swap') swap()
        else if (action === 'stick') stick()
        else putBack()
        return note.text
      },
    })
    return () => hand(null)
  })

  const about = 'A vending machine full of shrimp capsules, one row for each kind of note. Type a row letter like B, or a slot like B2, and press Enter, or ? for a surprise.'
  return (
    <div ref={wrap} className={`home__machine-stage ${className}`}>
      {onABoard ? (
        // On a board it takes focus, so its keys don't clash with the board's.
        <div className="home__machine" ref={stage} tabIndex={0} role="group" aria-label={`${about} Click it or tab to it first.`} />
      ) : (
        <div className="home__machine" ref={stage} role="img" aria-label={about} />
      )}
      {/* The keypad "says" this; clicking it moves in close to the keypad, facing it. */}
      <button type="button" ref={bubble} className="home__bubble" data-visible="false" disabled={!machine} onClick={() => machine?.showKeypad()}>
        use my keypad!
      </button>
      {note && (
        // The note comes out of the cracked token as the very box it'll be on the board.
        <div
          ref={noteBox}
          className={`vended${leaving ? ' vended--leaving' : ''}`}
          role="dialog"
          aria-label="A note from the vending machine"
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.stopPropagation()
              putBack()
            } else if (e.key.toLowerCase() === 's' && !e.ctrlKey && !e.metaKey) {
              e.preventDefault()
              swap()
            }
          }}
        >
          <div key={note.text} className="vended__body">
            <div className={`idea idea--spark idea--cat-${note.category} vended__note`}>
              <span className="idea__meta">
                <span className="idea__category">{CATEGORY_LABEL[note.category]}</span>
                <span className="idea__id">new</span>
              </span>
              <span className="idea__text">{note.text}</span>
            </div>
            {/* The note's actions, joined on under it like a little toolbar, each with its key. */}
            <div className="vended__actions" style={{ ['--cat' as string]: `var(--cat-${note.category})` }}>
              <button type="button" className="vended__go" onClick={onABoard ? stick : startBoard}>
                {onABoard ? 'stick on board' : 'start a board with this'}
                <kbd>enter</kbd>
              </button>
              <button type="button" onClick={swap}>
                swap
                <kbd>s</kbd>
              </button>
              <button type="button" onClick={putBack}>
                put back
                <kbd>esc</kbd>
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Zoom (or pinch on a trackpad), and back to the start; drag to turn the machine. */}
      <div className="home__zoom" role="group" aria-label="Zoom the machine">
        <button type="button" aria-label="Zoom in" disabled={!machine} onClick={() => machine?.zoomBy(1.25)}>
          +
        </button>
        <button type="button" aria-label="Zoom out" disabled={!machine} onClick={() => machine?.zoomBy(0.8)}>
          −
        </button>
        <button type="button" aria-label="Back to the start view" disabled={!machine} onClick={() => machine?.resetView()}>
          ⟲
        </button>
      </div>
    </div>
  )
}
