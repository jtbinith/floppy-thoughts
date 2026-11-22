// A small pixel-art down-vote: a triangle pointing down, on the same 7×6 grid as the heart. Filled
// when on, outlined when off. Uses the current text colour.
export function DownvoteIcon({ size = 11, filled = true }: { size?: number; filled?: boolean }) {
  return (
    <svg className="downvote-icon" width={size} height={(size * 6) / 7} viewBox="0 0 7 6" shapeRendering="crispEdges" fill="currentColor" aria-hidden="true">
      {filled ? (
        <path d="M0 1h7v1H0z M1 2h5v1H1z M2 3h3v1H2z M3 4h1v1H3z" />
      ) : (
        <path d="M0 1h7v1H0z M1 2h1v1H1z M5 2h1v1H5z M2 3h1v1H2z M4 3h1v1H4z M3 4h1v1H3z" />
      )}
    </svg>
  )
}
