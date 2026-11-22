// A small pixel-art bin for deleting, on a 7×7 grid like the heart: a handle, the lid, a gap, then
// the bin with two slats. (An × reads as "close", not "delete".) Uses the current text colour.
export function BinIcon({ size = 12 }: { size?: number }) {
  return (
    <svg className="bin-icon" width={size} height={size} viewBox="0 0 7 7" shapeRendering="crispEdges" fill="currentColor" aria-hidden="true">
      <path d="M2 0h3v1H2z M0 1h7v1H0z M1 3h1v3H1z M3 3h1v3H3z M5 3h1v3H5z M1 6h5v1H1z" />
    </svg>
  )
}
