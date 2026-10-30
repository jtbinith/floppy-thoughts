import { useEffect, useRef, useState } from 'react'
import { CATEGORY_LABEL } from '../lib/board'
import type { Spark } from '../lib/sparks/deal'
import { CrackedPixelShrimp } from './PixelShrimp'
import { colourOf } from './vendColours'

// The moment a note comes out of the machine, shown over the board: the capsule drops and pops
// open, the shrimp hops out, cracks in half like a fortune cookie, and the note is the slip of
// paper stretched between the two halves. Nothing happens until you choose: stick it on the
// board, or put it back. Click (or Enter) skips the animation.

const PLAY_MS = 2200
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

type Props = {
  note: Spark
  onStick: () => void
  onPutBack: () => void
}

export function NotePopup({ note, onStick, onPutBack }: Props) {
  const [playing, setPlaying] = useState(() => !reducedMotion())
  const stickRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!playing) return
    dialogRef.current?.focus()
    const timer = setTimeout(() => setPlaying(false), PLAY_MS)
    return () => clearTimeout(timer)
  }, [playing])

  useEffect(() => {
    if (!playing) stickRef.current?.focus()
  }, [playing])

  return (
    <div className="popup" onClick={() => (playing ? setPlaying(false) : onStick())}>
      <div
        ref={dialogRef}
        className={`popup__card${playing ? ' popup__card--playing' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label="A new note from the vending machine"
        tabIndex={-1}
        style={{ ['--cat' as string]: colourOf(note.category) }}
        onClick={(e) => {
          e.stopPropagation()
          if (playing) setPlaying(false)
        }}
        onKeyDown={(e) => {
          e.stopPropagation()
          if (e.key === 'Escape') onPutBack()
          else if (e.key === 'Enter' && playing) {
            e.preventDefault()
            setPlaying(false)
          }
        }}
      >
        <div className="popup__stage">
          <span className="popup__capsule-top" aria-hidden="true" />
          <span className="popup__capsule-base" aria-hidden="true" />
          <p className="popup__slip" aria-live="polite">
            <small>~/{CATEGORY_LABEL[note.category]}</small>
            {note.text}
          </p>
          <CrackedPixelShrimp />
        </div>

        <div className="popup__actions">
          <button ref={stickRef} type="button" className="popup__stick" onClick={onStick}>
            stick it on the board
          </button>
          <button type="button" className="popup__back" onClick={onPutBack}>
            put it back
          </button>
        </div>
      </div>
    </div>
  )
}
