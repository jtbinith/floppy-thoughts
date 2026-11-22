// A small pixel-art tick, two pixels thick so it reads at a glance: a short stroke down, then a
// long one up. Uses the current text colour.
export function TickIcon({ size = 20 }: { size?: number }) {
  return (
    <svg className="tick-icon" width={size} height={(size * 6) / 8} viewBox="0 0 8 6" shapeRendering="crispEdges" fill="currentColor" aria-hidden="true">
      <path d="M6 0h2v1H6z M5 1h2v1H5z M4 2h2v1H4z M0 3h2v1H0z M3 3h2v1H3z M1 4h3v1H1z M2 5h1v1H2z" />
    </svg>
  )
}
