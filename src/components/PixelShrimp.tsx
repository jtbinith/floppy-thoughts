import { SHRIMP_GRID, shrimpPixels, type Part, type Shade } from '../lib/shrimpPixels'

// Our own pixel-art shrimp (see lib/shrimpPixels). It can crack in half like a fortune cookie.

const COLOUR: Record<Shade, string> = {
  ink: '#2f2526',
  body: '#ff8f6b',
  shade: '#d9573a',
  light: '#ffc2a8',
  eye: '#2f2526',
}

// How curled the shrimp is in the popup before it cracks.
const CRACK_GAP = 40

const cache = new Map<string, ReturnType<typeof shrimpPixels>>()
const pixelsFor = (gap: number, cracked = false) => {
  const k = `${gap}:${cracked}`
  if (!cache.has(k)) cache.set(k, shrimpPixels(gap, cracked))
  return cache.get(k)!
}

function Pixels({ gap, cracked, part }: { gap: number; cracked?: boolean; part?: Part }) {
  return (
    <>
      {pixelsFor(gap, cracked)
        .filter((p) => !part || p.part === part)
        .map((p) => (
          <rect key={`${p.x},${p.y}`} x={p.x} y={p.y} width="1.02" height="1.02" fill={COLOUR[p.shade]} />
        ))}
    </>
  )
}

const viewBox = `0 0 ${SHRIMP_GRID.width} ${SHRIMP_GRID.height}`

// The shrimp in two halves, drawn on top of each other so it looks whole (with a crack) until
// the CSS pulls the halves apart.
export function CrackedPixelShrimp() {
  return (
    <span className="cracked-shrimp" aria-hidden="true">
      {(['head', 'tail'] as const).map((part) => (
        <svg key={part} className={`cracked-shrimp__half cracked-shrimp__half--${part}`} viewBox={viewBox} shapeRendering="crispEdges">
          <Pixels gap={CRACK_GAP} cracked part={part} />
        </svg>
      ))}
    </span>
  )
}
