import { useEffect, useRef, useState } from 'react'
import { createMachineScene, type MachineScene } from './scene'
import { THEMES } from './themes'

// PROTOTYPE: just the vending machine, as a live 3D scene, to find the feel. Lives at #/machine.

const PIXEL_SIZES = [
  { label: 'chunky', size: 4 },
  { label: 'pixel', size: 3 },
  { label: 'fine', size: 2 },
  { label: 'smooth', size: 1 },
]

export function MachinePage() {
  const stage = useRef<HTMLDivElement>(null)
  const scene = useRef<MachineScene | null>(null)
  const [pixel, setPixel] = useState(2)
  const [themeId, setThemeId] = useState(THEMES[0].id)

  // A new colour version rebuilds the machine.
  useEffect(() => {
    if (!stage.current) return
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const theme = THEMES.find((t) => t.id === themeId) ?? THEMES[0]
    scene.current = createMachineScene(stage.current, { reducedMotion, theme })
    scene.current.setPixelSize(pixel)
    return () => scene.current?.dispose()
    // Only when the colours change; pixel size is applied without a rebuild.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [themeId])

  return (
    <div className="machine">
      <div className="machine__stage" ref={stage} />
      <div className="machine__ui">
        <button type="button" className="machine__vend" onClick={() => scene.current?.vend()}>
          get a shrimp
        </button>
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
      <div className="machine__themes" role="group" aria-label="Machine colours">
        {THEMES.map((t) => (
          <button key={t.id} type="button" aria-pressed={themeId === t.id} onClick={() => setThemeId(t.id)}>
            <span style={{ background: t.body, borderColor: t.trim }} aria-hidden="true" />
            {t.label}
          </button>
        ))}
      </div>
      <small className="machine__hint">type a code like B2 and press Enter (or click the keys) · drag to look around · scroll to zoom</small>
      <small className="machine__badge">prototype · placeholder shapes</small>
    </div>
  )
}
