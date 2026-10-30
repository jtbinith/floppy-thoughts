import { useEffect, useRef, type ReactNode } from 'react'

// A small popup over the board, in the same style as the shrimp-note popup.
// Esc or clicking outside cancels; focus moves into it so the keyboard works straight away.
type Props = {
  label: string
  onCancel: () => void
  children: ReactNode
  wide?: boolean
}

export function Dialog({ label, onCancel, children, wide = false }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const first = ref.current?.querySelector<HTMLElement>('[autofocus], input, button')
    ;(first ?? ref.current)?.focus()
  }, [])
  return (
    <div className="popup" onClick={onCancel}>
      <div
        ref={ref}
        className={`popup__card dialog${wide ? ' dialog--wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          e.stopPropagation()
          if (e.key === 'Escape') onCancel()
        }}
      >
        {children}
      </div>
    </div>
  )
}
