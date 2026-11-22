// A small pixel-art folder, on the same kind of grid as the heart and the bin: a tab, then the
// folder. Uses the current text colour.
export function FolderIcon({ size = 16 }: { size?: number }) {
  return (
    <svg className="folder-icon" width={size} height={(size * 7) / 8} viewBox="0 0 8 7" shapeRendering="crispEdges" fill="currentColor" aria-hidden="true">
      <path d="M0 0h3v1H0z M0 1h8v1H0z M0 2h1v4H0z M7 2h1v4H7z M0 6h8v1H0z" />
      <path d="M1 2h6v4H1z" opacity="0.35" />
    </svg>
  )
}
