// A bold tick and cross with rounded ends, drawn as thick strokes. They use the current text colour.

export function TickIcon({ size = 18 }: { size?: number }) {
  return (
    <svg className="tick-icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 12.5 9.5 18 20 6.5" />
    </svg>
  )
}

export function CrossIcon({ size = 16 }: { size?: number }) {
  return (
    <svg className="cross-icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={4} strokeLinecap="round" aria-hidden="true">
      <path d="M6 6 18 18 M18 6 6 18" />
    </svg>
  )
}
