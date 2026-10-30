// A small pixel-art heart for favourites, on a 7×6 grid like the lock. Filled when on, outlined when off.
// Uses the current text colour.
export function HeartIcon({ size = 11, filled = true }: { size?: number; filled?: boolean }) {
  return (
    <svg
      className="heart-icon"
      width={size}
      height={(size * 6) / 7}
      viewBox="0 0 7 6"
      shapeRendering="crispEdges"
      fill="currentColor"
      aria-hidden="true"
    >
      {filled ? (
        <path d="M1 0h2v1h1V0h2v1h1v2H6v1H5v1H4v1H3V5H2V4H1V3H0V1h1z" />
      ) : (
        <path
          fillRule="evenodd"
          d="M1 0h2v1h1V0h2v1h1v2H6v1H5v1H4v1H3V5H2V4H1V3H0V1h1z M1 1v2h1v1h1v1h1V4h1V3h1V1H5v1H4v1H3V2H2V1z"
        />
      )}
    </svg>
  )
}
