import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { NUDGE_LABEL, type NudgeChoice } from '../lib/nudges/pickNudge'
import { useBoardActions } from './boardActions'

// The nudge button on a box: "nudge" picks a type that fits, and the ▾ beside it opens a small menu
// to choose one (something related, an opposite, a rhyme, someone else's view…). Only the types
// that fit the box are offered. Esc, a tap anywhere else, or scrolling closes it. The menu is drawn
// over the whole page next to the button (so the board or the bar along the bottom can't cut it
// off), below it, or above it when there isn't room below.
export function NudgeButton({ id, number, className }: { id: string; number: number; className: string }) {
  const { nudge, nudgeTypes } = useBoardActions()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLSpanElement>(null)
  const menu = useRef<HTMLSpanElement>(null)
  const [at, setAt] = useState<{ left: number; top: number } | null>(null)
  const types: NudgeChoice[] = open ? nudgeTypes(id) : []

  // Where the menu goes: under the button, or above it if it would run off the bottom.
  useLayoutEffect(() => {
    if (!open || !ref.current || !menu.current) return
    const button = ref.current.getBoundingClientRect()
    const { width, height } = menu.current.getBoundingClientRect()
    const below = button.bottom + 4
    const top = below + height > window.innerHeight - 8 ? Math.max(8, button.top - height - 4) : below
    const left = Math.min(Math.max(8, button.left), window.innerWidth - width - 8)
    setAt({ left, top })
  }, [open])

  useEffect(() => {
    if (!open) return
    menu.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus()
    const away = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && !menu.current?.contains(e.target as Node) && setOpen(false)
    const close = () => setOpen(false)
    document.addEventListener('pointerdown', away)
    window.addEventListener('resize', close)
    window.addEventListener('wheel', close, { passive: true })
    return () => {
      document.removeEventListener('pointerdown', away)
      window.removeEventListener('resize', close)
      window.removeEventListener('wheel', close)
    }
  }, [open])

  const choose = (type?: NudgeChoice) => {
    setOpen(false)
    setAt(null)
    nudge(id, type)
  }
  const toggle = () => {
    setAt(null)
    setOpen(!open)
  }

  return (
    <span className="nudge-button nodrag" ref={ref} onKeyDown={(e) => e.key === 'Escape' && (e.stopPropagation(), setOpen(false))}>
      <button type="button" className={className} aria-label={`Nudge ${number}`} title="A word or question to push this further (N)" onClick={() => choose()}>
        nudge
      </button>
      <button
        type="button"
        className={`${className} nudge-button__more`}
        aria-label={`Choose a kind of nudge for ${number}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={toggle}
      >
        <span aria-hidden="true">▾</span>
      </button>
      {open &&
        createPortal(
          <span
            ref={menu}
            className="nudge-button__menu"
            role="menu"
            aria-label="Kind of nudge"
            style={at ? { left: at.left, top: at.top } : { left: -9999, top: 0 }}
            onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
          >
            <button type="button" role="menuitem" onClick={() => choose()}>
              any kind
            </button>
            {types.map((t) => (
              <button key={t} type="button" role="menuitem" onClick={() => choose(t)}>
                {NUDGE_LABEL[t]}
              </button>
            ))}
          </span>,
          document.body,
        )}
    </span>
  )
}
