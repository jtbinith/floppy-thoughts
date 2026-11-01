import { useEffect, useRef, useState, type KeyboardEvent } from 'react'

// A title strip like VS Code's: Board, Edit, View and Help menus on the left.
// Click a menu to open it; while one is open, hovering another switches to it.
// Arrow keys move around, Enter picks, Esc closes.

export type MenuItem = { label: string; shortcut?: string; onSelect: () => void; disabled?: boolean } | 'divider'
export type Menu = { label: string; items: MenuItem[] }

export function MenuBar({ menus }: { menus: Menu[] }) {
  const [open, setOpen] = useState<number | null>(null)
  const [active, setActive] = useState(0)
  const barRef = useRef<HTMLDivElement>(null)

  // Clicking anywhere else closes the menu.
  useEffect(() => {
    if (open === null) return
    const onDown = (e: PointerEvent) => {
      if (!barRef.current?.contains(e.target as Node)) setOpen(null)
    }
    window.addEventListener('pointerdown', onDown)
    return () => window.removeEventListener('pointerdown', onDown)
  }, [open])

  // Keep keyboard focus on the highlighted item.
  useEffect(() => {
    if (open === null) return
    barRef.current?.querySelector<HTMLElement>(`[data-menu="${open}"] [data-item="${active}"]`)?.focus()
  }, [open, active])

  const items = (i: number) => menus[i].items
  const usable = (i: number) => items(i).flatMap((item, n) => (item !== 'divider' && !item.disabled ? [n] : []))

  function openMenu(i: number) {
    setOpen(i)
    setActive(usable(i)[0] ?? 0)
  }

  function pick(item: MenuItem) {
    if (item === 'divider' || item.disabled) return
    setOpen(null)
    item.onSelect()
  }

  function onKeyDown(e: KeyboardEvent) {
    if (open === null) return
    const choices = usable(open)
    const at = choices.indexOf(active)
    if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      setOpen(null)
      barRef.current?.querySelector<HTMLElement>(`[data-title="${open}"]`)?.focus()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive(choices[(at + 1) % choices.length])
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive(choices[(at - 1 + choices.length) % choices.length])
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault()
      openMenu((open + (e.key === 'ArrowRight' ? 1 : -1) + menus.length) % menus.length)
    }
  }

  return (
    <div className="menubar" role="menubar" ref={barRef} onKeyDown={onKeyDown}>
      {menus.map((menu, i) => (
        <div key={menu.label} className="menubar__menu" data-menu={i}>
          <button
            type="button"
            className={`menubar__title${open === i ? ' menubar__title--open' : ''}`}
            role="menuitem"
            aria-haspopup="menu"
            aria-expanded={open === i}
            data-title={i}
            onClick={() => (open === i ? setOpen(null) : openMenu(i))}
            onPointerEnter={() => open !== null && open !== i && openMenu(i)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                openMenu(i)
              }
            }}
          >
            {menu.label}
          </button>
          {open === i && (
            <div className="menubar__list" role="menu" aria-label={menu.label}>
              {menu.items.map((item, n) =>
                item === 'divider' ? (
                  <div key={`d${n}`} className="menubar__divider" role="separator" />
                ) : (
                  <button
                    key={n}
                    type="button"
                    role="menuitem"
                    className="menubar__item"
                    data-item={n}
                    disabled={item.disabled}
                    tabIndex={n === active ? 0 : -1}
                    onPointerEnter={() => !item.disabled && setActive(n)}
                    onClick={() => pick(item)}
                  >
                    <span>{item.label}</span>
                    {item.shortcut && <kbd>{item.shortcut}</kbd>}
                  </button>
                ),
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
