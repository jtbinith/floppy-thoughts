import { useEffect, useRef, useState } from 'react'
import { createMachineScene, type MachineScene } from './scene'
import { THEMES } from './themes'

// The live 3D vending machine for the home page: circuit teal, on a see-through background so it
// sits on the page in dark or light mode. Loaded on its own, so the 3D library only downloads here.

export default function HomeMachine() {
  const stage = useRef<HTMLDivElement>(null)
  const bubble = useRef<HTMLButtonElement>(null)
  const [machine, setMachine] = useState<MachineScene | null>(null)
  useEffect(() => {
    const el = stage.current
    if (!el) return
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let scene: MachineScene | null = null
    let live = true
    // The machine's row letters (Bungee) and keys (Courier Prime) are drawn as pictures, so wait for the fonts first.
    Promise.all([document.fonts.load('96px Bungee'), document.fonts.load('bold 52px "Courier Prime"')])
      .catch(() => undefined)
      .then(() => {
        if (!live) return
        // The keypad's speech bubble follows the keypad around as the machine turns.
        const onKeypad = ({ x, y, visible }: { x: number; y: number; visible: boolean }) => {
          const b = bubble.current
          if (!b) return
          b.style.transform = `translate(${Math.round(x) + 4}px, calc(${Math.round(y) - 14}px - 100%))`
          b.dataset.visible = String(visible)
          b.tabIndex = visible ? 0 : -1
        }
        scene = createMachineScene(el, { reducedMotion, theme: THEMES[0], embedded: true, onKeypad })
        setMachine(scene)
      })
    return () => {
      live = false
      setMachine(null)
      scene?.dispose()
    }
  }, [])
  return (
    <div className="home__machine-stage">
      <div
        className="home__machine"
        ref={stage}
        role="img"
        aria-label="A vending machine full of shrimp capsules, one row for each kind of note. Type a row letter like B, or a slot like B2, and press Enter, or ? for a surprise."
      />
      {/* The keypad "says" this; clicking it moves in close to the keypad, facing it. */}
      <button type="button" ref={bubble} className="home__bubble" data-visible="false" disabled={!machine} onClick={() => machine?.showKeypad()}>
        use my keypad!
      </button>
      {/* Zoom (or pinch on a trackpad), and back to the start; drag to turn the machine. */}
      <div className="home__zoom" role="group" aria-label="Zoom the machine">
        <button type="button" aria-label="Zoom in" disabled={!machine} onClick={() => machine?.zoomBy(1.25)}>
          +
        </button>
        <button type="button" aria-label="Zoom out" disabled={!machine} onClick={() => machine?.zoomBy(0.8)}>
          −
        </button>
        <button type="button" aria-label="Back to the start view" disabled={!machine} onClick={() => machine?.resetView()}>
          ⟲
        </button>
      </div>
    </div>
  )
}
