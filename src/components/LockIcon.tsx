// A small pixel-art padlock, drawn on a 7×8 grid so it stays crisp and matches the device look.
// Uses the current text colour.
export function LockIcon({ size = 10 }: { size?: number }) {
  return (
    <svg
      className="lock-icon"
      width={size}
      height={(size * 8) / 7}
      viewBox="0 0 7 8"
      shapeRendering="crispEdges"
      fill="currentColor"
      role="img"
      aria-label="locked"
    >
      {/* shackle */}
      <rect x="2" y="0" width="3" height="1" />
      <rect x="1" y="1" width="1" height="2" />
      <rect x="5" y="1" width="1" height="2" />
      {/* body with a keyhole */}
      <path d="M0 3h7v5H0z M3 4.5h1v2H3z" fillRule="evenodd" />
    </svg>
  )
}
