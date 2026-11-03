import { useEffect, useRef, useState } from 'react'
import { createShrimpScene, type ShrimpScene } from './scene'

// PROTOTYPE: the shrimp token (the shrimp glyph as a chunky spinning pickup), as a live 3D scene,
// to get its look right. Lives at #/shrimp.
// Borrows the machine page's styles.

const PIXEL_SIZES = [
  { label: 'chunky', size: 4 },
  { label: 'pixel', size: 3 },
  { label: 'fine', size: 2 },
  { label: 'smooth', size: 1 },
]

export function ShrimpPage() {
  const stage = useRef<HTMLDivElement>(null)
  const scene = useRef<ShrimpScene | null>(null)
  const [pixel, setPixel] = useState(3)

  useEffect(() => {
    if (!stage.current) return
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    scene.current = createShrimpScene(stage.current, { reducedMotion })
    return () => scene.current?.dispose()
  }, [])

  return (
    <div className="machine">
      <div className="machine__stage" ref={stage} />
      <div className="machine__ui">
        <div className="machine__pixels" role="group" aria-label="Pixel size">
          {PIXEL_SIZES.map((p) => (
            <button
              key={p.size}
              type="button"
              aria-pressed={pixel === p.size}
              onClick={() => {
                setPixel(p.size)
                scene.current?.setPixelSize(p.size)
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>
      <small className="machine__hint">drag to look around · scroll to zoom</small>
      <small className="machine__badge">prototype · shrimp token</small>
    </div>
  )
}
