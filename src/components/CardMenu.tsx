import { useEffect, useRef } from 'react'

// A card's ⋯ menu (a board or a folder on the boards page): rename, move and delete, kept off the
// card until you ask. Esc, or a tap
// anywhere else, closes it.
export function CardMenu({ label, name, open, onToggle, onRename, onMove, onDelete }: { label: string; name: string; open: boolean; onToggle: (open: boolean) => void; onRename: () => void; onMove?: () => void; onDelete: () => void }) {
  const ref = useRef<HTMLSpanElement>(null)
  const toggle = useRef(onToggle)
  useEffect(() => {
    toggle.current = onToggle
  })
  useEffect(() => {
    if (!open) return
    ref.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus()
    const away = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && toggle.current(false)
    document.addEventListener('pointerdown', away)
    return () => document.removeEventListener('pointerdown', away)
  }, [open])
  const pick = (action: () => void) => () => {
    onToggle(false)
    action()
  }
  return (
    <span className="card-menu" ref={ref} onKeyDown={(e) => e.key === 'Escape' && onToggle(false)} onTouchStart={(e) => e.stopPropagation()}>
      <button type="button" className="card-menu__button" aria-label={label} aria-haspopup="menu" aria-expanded={open} onClick={() => onToggle(!open)}>
        <span aria-hidden="true">⋯</span>
      </button>
      {open && (
        <span className="card-menu__list" role="menu" aria-label={`${name} options`}>
          <button type="button" role="menuitem" onClick={pick(onRename)}>
            rename
          </button>
          {onMove && (
            <button type="button" role="menuitem" onClick={pick(onMove)}>
              move
            </button>
          )}
          <button type="button" role="menuitem" className="card-menu__danger" onClick={pick(onDelete)}>
            delete
          </button>
        </span>
      )}
    </span>
  )
}
