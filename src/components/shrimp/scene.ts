import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { createKit, INK } from '../machine/kit'
import { buildToken } from './token'

// PROTOTYPE: the shrimp token as a live 3D scene, drawn the same way as the machine (toon
// shading, ink outlines, low resolution scaled up) so it reads as pixel art. The token itself is
// built in ./token.

export type ShrimpScene = {
  setPixelSize: (size: number) => void
  dispose: () => void
}

export function createShrimpScene(container: HTMLElement, opts: { reducedMotion: boolean }): ShrimpScene {
  const kit = createKit()
  const { inked } = kit
  // The kit's darkest band is near-black brown; the inspo's shadows stay orange, so each colour
  // glows a little of itself to lift its shadows.
  const toon = (color: string) => kit.toon(color, { emissive: new THREE.Color(color).multiplyScalar(0.35) })
  const keep = kit.keep

  // --- Renderer, camera, light (as the machine) ---
  const renderer = new THREE.WebGLRenderer({ antialias: false })
  renderer.shadowMap.enabled = true
  renderer.setClearColor('#17110e')
  renderer.domElement.className = 'machine__canvas'
  container.appendChild(renderer.domElement)

  const scene = new THREE.Scene()
  const camera = new THREE.OrthographicCamera()
  const view = { zoom: 1.9 }
  camera.position.set(6, 3, 8)
  const lookAt = new THREE.Vector3(0, 1.0, 0)

  scene.add(new THREE.HemisphereLight('#ffe4c8', '#3b2416', 1.4))
  const sun = new THREE.DirectionalLight('#fff1dc', 2.2)
  sun.position.set(-4, 8, 6)
  sun.castShadow = true
  sun.shadow.mapSize.set(1024, 1024)
  sun.shadow.bias = -0.0005
  sun.shadow.normalBias = 0.03
  Object.assign(sun.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4 })
  scene.add(sun)

  const floor = new THREE.Mesh(keep(new THREE.PlaneGeometry(10, 10)), keep(new THREE.ShadowMaterial({ color: '#000000', opacity: 0.35 })))
  floor.rotation.x = -Math.PI / 2
  floor.receiveShadow = true
  scene.add(floor)

  // Thin, bendy parts (antennae, legs) are tubes along a curve, each with a fatter ink tube behind
  // it as its outline (the kit's outline doesn't suit long curly shapes).
  const inkMat = keep(new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide }))
  const tube = (points: [number, number, number][], radius: number, color: string, parent: THREE.Object3D) => {
    const path = new THREE.CatmullRomCurve3(points.map(([x, y, z]) => new THREE.Vector3(x, y, z)))
    const m = new THREE.Mesh(keep(new THREE.TubeGeometry(path, 32, radius, 6)), toon(color))
    m.castShadow = true
    m.add(new THREE.Mesh(keep(new THREE.TubeGeometry(path, 32, radius + 0.02, 6)), inkMat))
    parent.add(m)
    return m
  }

  // --- The token: the shrimp glyph as a chunky spinning pickup ---
  const token = buildToken({ inked, toon, keep, tube })
  scene.add(token.group)

  // --- Sizing: draw at a fraction of the screen's pixels, so it looks like pixel art ---
  let pixelSize = 3
  function resize() {
    const { clientWidth: w, clientHeight: h } = container
    renderer.setPixelRatio(1 / pixelSize)
    renderer.setSize(w, h)
    const aspect = w / h
    Object.assign(camera, { left: -view.zoom * aspect, right: view.zoom * aspect, top: view.zoom, bottom: -view.zoom, near: 0.1, far: 100 })
    camera.updateProjectionMatrix()
  }
  resize()
  const ro = new ResizeObserver(resize)
  ro.observe(container)

  const controls = new OrbitControls(camera, renderer.domElement)
  controls.target.copy(lookAt)
  controls.enableDamping = true
  controls.enablePan = false
  controls.minZoom = 0.6
  controls.maxZoom = 3
  controls.maxPolarAngle = Math.PI / 2 - 0.05
  controls.update()

  // --- Spinning, bobbing and sparkling ---
  const clock = new THREE.Clock()
  renderer.setAnimationLoop(() => {
    token.update(clock.getElapsedTime(), opts.reducedMotion)
    controls.update()
    renderer.render(scene, camera)
  })

  return {
    setPixelSize(size) {
      pixelSize = size
      resize()
    },
    dispose() {
      ro.disconnect()
      controls.dispose()
      renderer.setAnimationLoop(null)
      kit.dispose()
      renderer.dispose()
      renderer.domElement.remove()
    },
  }
}
