import { useState } from 'react'
import { currentTheme, setTheme, type Theme } from '../lib/theme'

// A sun/moon button that switches between dark and light mode.
export function ThemeToggle({ className = '' }: { className?: string }) {
  const [theme, setLocal] = useState<Theme>(currentTheme)
  const next: Theme = theme === 'dark' ? 'light' : 'dark'
  return (
    <button
      type="button"
      className={`theme-toggle ${className}`}
      aria-label={`Switch to ${next} mode`}
      title={`Switch to ${next} mode`}
      onClick={() => {
        setTheme(next)
        setLocal(next)
      }}
    >
      {theme === 'dark' ? <MoonIcon /> : <SunIcon />}
    </button>
  )
}

// Drawn on a pixel grid, to match the rest of the site.
function SunIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 16 16" shapeRendering="crispEdges" aria-hidden="true">
      <g fill="currentColor">
        <rect x="6" y="5" width="4" height="6" />
        <rect x="5" y="6" width="6" height="4" />
        <rect x="7" y="1" width="2" height="2" />
        <rect x="7" y="13" width="2" height="2" />
        <rect x="1" y="7" width="2" height="2" />
        <rect x="13" y="7" width="2" height="2" />
        <rect x="3" y="3" width="2" height="2" />
        <rect x="11" y="3" width="2" height="2" />
        <rect x="3" y="11" width="2" height="2" />
        <rect x="11" y="11" width="2" height="2" />
      </g>
    </svg>
  )
}

// A crescent: a disc with a smaller disc cut out of its top right, on the same pixel grid.
const MOON = (() => {
  const cells: [number, number][] = []
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 16; x++) {
      const inMoon = (x - 7.5) ** 2 + (y - 7.5) ** 2 <= 6.2 ** 2
      const inBite = (x - 10.5) ** 2 + (y - 5) ** 2 <= 5 ** 2
      if (inMoon && !inBite) cells.push([x, y])
    }
  return cells
})()

function MoonIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 16 16" shapeRendering="crispEdges" aria-hidden="true">
      <g fill="currentColor">
        {MOON.map(([x, y]) => (
          <rect key={`${x},${y}`} x={x} y={y} width="1" height="1" />
        ))}
      </g>
    </svg>
  )
}
