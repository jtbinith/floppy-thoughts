import * as THREE from 'three'
import gsap from 'gsap'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { CATEGORIES } from './categories'
import { createKit, INK } from './kit'
import { createLedSign, LED } from './led'
import { bestText } from '../../lib/contrast'
import type { MachineTheme } from './themes'

// PROTOTYPE: the vending machine as a live 3D scene. Toon shading with ink outlines makes it look
// drawn, and rendering at a fraction of the screen's resolution (scaled up without smoothing)
// makes it read as 3D pixel art. Built one aspect at a time: for now, the machine, a keypad and
// a capsule.

// The colours that stay the same in every version (the rest come from the theme).
const COLOURS = {
  glass: '#f6e3cc',
  capsuleBottom: '#f6e3cc',
  screen: '#1c2a1a',
  screenText: '#9fd46a',
  key: '#f6e3cc',
}

const SLOTS = 3

// What the LED sign scrolls. Leave the page alone for a while and it nags you about your posture
// (coders hunch like shrimp, which is where the shrimp came from).
const SIGN = { main: '404: idea not found...yet', idle: 'sit up straight', idleAfter: 45 }
const LETTERS = CATEGORIES.map((_, i) => String.fromCharCode(65 + i))
// Dark letters on light keys, cream letters on dark ones: whichever reads better.
const labelOn = (bg: string) => bestText(bg, [INK, '#f6e3cc'])

// Text painted onto a canvas. Kept sharp (no smoothing between texels).
function canvasTexture(width: number, height: number, paint: (ctx: CanvasRenderingContext2D) => void) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')!
  paint(ctx)
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.generateMipmaps = false
  tex.minFilter = THREE.LinearFilter
  tex.magFilter = THREE.NearestFilter
  return { tex, ctx, canvas }
}
const centredText = (text: string, bg: string, fg: string, font: string, width = 512, height = 128) =>
  canvasTexture(width, height, (ctx) => {
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, width, height)
    ctx.fillStyle = fg
    ctx.font = font
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(text, width / 2, height / 2 + 4)
  }).tex

export type MachineScene = {
  // Vend from a slot code like "B2", or a surprise if there's no code.
  vend: (code?: string) => void
  // Zoom in (more than 1) or out (less than 1), close up on the keypad, and back to the starting view.
  zoomBy: (factor: number) => void
  showKeypad: () => void
  resetView: () => void
  setPixelSize: (size: number) => void
  dispose: () => void
}

export function createMachineScene(container: HTMLElement, opts: {
    reducedMotion: boolean
    theme: MachineTheme
    // Sitting inside a page: see-through background with just the machine's shadow, and no scroll-to-zoom
    // (so scrolling the page still scrolls the page).
    embedded?: boolean
    // Other colours for the six rows, in order (to try palettes).
    categoryColours?: string[]
    // Called every frame with where the keypad is on screen (in CSS pixels from the canvas's top
    // left), and whether it's facing you, so the page can point at it.
    onKeypad?: (at: { x: number; y: number; visible: boolean }) => void
  },
): MachineScene {
  const theme = opts.theme
  const cats = CATEGORIES.map((c, i) => ({ ...c, colour: opts.categoryColours?.[i] ?? c.colour }))
  const kit = createKit()
  const { toon, inked, box } = kit
  const disposables: { dispose: () => void }[] = [kit]
  const keep = <T extends { dispose: () => void }>(t: T) => (disposables.push(t), t)

  // --- Renderer, camera, light ---
  const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: opts.embedded })
  renderer.shadowMap.enabled = true
  if (opts.embedded) renderer.setClearColor(0x000000, 0)
  else renderer.setClearColor(theme.floor)
  renderer.domElement.className = 'machine__canvas'
  container.appendChild(renderer.domElement)

  const scene = new THREE.Scene()

  // An orthographic camera at an isometric-ish angle, like a pixel-art game.
  const camera = new THREE.OrthographicCamera()
  const view = { zoom: 2.9 }
  camera.position.set(9, 7, 11)
  // In a page, frame the machine and the floor in front of it, so a vended capsule's whole roll is
  // already in view (no camera move needed), with room for the shadow.
  const lookAt = opts.embedded ? new THREE.Vector3(0.2, 1.7, 1.2) : new THREE.Vector3(0, 1.85, 0.6)

  scene.add(new THREE.HemisphereLight('#ffe4c8', '#3b2416', 1.4))
  const sun = new THREE.DirectionalLight('#fff1dc', 2.2)
  sun.position.set(-5, 10, 6)
  sun.castShadow = true
  sun.shadow.mapSize.set(2048, 2048)
  // Stops the streaky "shadow acne" on the machine's own sides.
  sun.shadow.bias = -0.0005
  sun.shadow.normalBias = 0.03
  Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9 })
  scene.add(sun)

  const floor = new THREE.Mesh(
    keep(new THREE.PlaneGeometry(60, 60)),
    opts.embedded ? keep(new THREE.ShadowMaterial({ color: '#17110e', opacity: 0.35 })) : toon(theme.floor),
  )
  floor.rotation.x = -Math.PI / 2
  floor.receiveShadow = true
  scene.add(floor)

  // --- The machine ---
  const machine = new THREE.Group()
  scene.add(machine)
  const W = 2.4
  const H = 3.4
  const D = 1.4
  const front = D / 2

  const body = box(W, H, D, theme.body)
  body.position.y = H / 2
  machine.add(body)

  // The sign on top: an LED dot-matrix display in a dark case with an orange rim, scrolling a
  // little message in a loop.
  const led = keep(createLedSign([SIGN.main], { reducedMotion: opts.reducedMotion }))
  const ledW = W * 0.86
  const ledH = (ledW * LED.rows) / LED.cols
  const signCase = box(ledW + 0.12, ledH + 0.12, 0.28, theme.signCase, 0.025)
  signCase.position.set(0, H + 0.3, front - 0.14)
  machine.add(signCase)
  const rim = toon(theme.signRim)
  for (const [w, h, x, y] of [
    [ledW + 0.12, 0.05, 0, (ledH + 0.12) / 2],
    [ledW + 0.12, 0.05, 0, -(ledH + 0.12) / 2],
    [0.05, ledH + 0.12, -(ledW + 0.12) / 2, 0],
    [0.05, ledH + 0.12, (ledW + 0.12) / 2, 0],
  ]) {
    const r = inked(new THREE.BoxGeometry(w, h, 0.3), rim, 0.012)
    r.position.set(x, H + 0.3 + y, front - 0.13)
    machine.add(r)
  }
  // The dots light themselves, so the display isn't shaded by the scene's light.
  const ledFace = new THREE.Mesh(keep(new THREE.PlaneGeometry(ledW, ledH)), keep(new THREE.MeshBasicMaterial({ map: led.texture })))
  ledFace.position.set(0, H + 0.3, front + 0.005)
  machine.add(ledFace)

  // --- The window: one shelf per category, each with its letter, behind a faint pane of glass ---
  const win = { x: -0.25, y: 2.15, w: 1.25, h: 1.9 }
  const windowBack = box(win.w, win.h, 0.04, theme.window, 0.03)
  windowBack.position.set(win.x, win.y, front + 0.02)
  machine.add(windowBack)

  const capsuleTop = keep(new THREE.SphereGeometry(0.16, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2))
  const capsuleBottom = keep(new THREE.SphereGeometry(0.16, 12, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2))
  const makeCapsule = (color: string) => {
    const g = new THREE.Group()
    g.add(inked(capsuleTop, toon(color), 0.02), inked(capsuleBottom, toon(COLOURS.capsuleBottom), 0.02))
    return g
  }

  const rowGap = win.h / cats.length
  const slots: THREE.Group[][] = []
  cats.forEach((cat, row) => {
    // Row A at the top.
    const y = win.y + win.h / 2 - rowGap * (row + 1) + 0.04
    const shelf = box(win.w - 0.1, 0.035, 0.3, theme.trim, 0.012)
    shelf.position.set(win.x, y, front + 0.17)
    machine.add(shelf)
    // The row's letter on a little plate at the left.
    const plateTex = keep(centredText(LETTERS[row], cat.colour, labelOn(cat.colour), '96px "Bungee", system-ui, sans-serif', 128, 128))
    const plate = inked(new THREE.BoxGeometry(0.15, 0.15, 0.02), [toon(cat.colour), toon(cat.colour), toon(cat.colour), toon(cat.colour), toon('#ffffff', { map: plateTex }), toon(cat.colour)], 0.012)
    plate.position.set(win.x - win.w / 2 + 0.13, y + 0.12, front + 0.06)
    machine.add(plate)
    const rowCapsules: THREE.Group[] = []
    for (let col = 0; col < SLOTS; col++) {
      const c = makeCapsule(cat.colour)
      c.scale.setScalar(0.72)
      c.position.set(win.x - 0.12 + col * 0.27, y + 0.12, front + 0.18)
      c.rotation.z = (col - 1) * 0.4
      machine.add(c)
      rowCapsules.push(c)
    }
    slots.push(rowCapsules)
  })
  const glassMat = keep(new THREE.MeshBasicMaterial({ color: COLOURS.glass, transparent: true, opacity: 0.12, depthWrite: false }))
  const glass = new THREE.Mesh(keep(new THREE.BoxGeometry(win.w, win.h, 0.02)), glassMat)
  glass.position.set(win.x, win.y, front + 0.36)
  machine.add(glass)
  // The frame around the glass: four bars, so it doesn't hide what's behind.
  const bar = 0.07
  for (const [w, h, x, y] of [
    [win.w + bar * 2, bar, win.x, win.y + win.h / 2 + bar / 2],
    [win.w + bar * 2, bar, win.x, win.y - win.h / 2 - bar / 2],
    [bar, win.h, win.x - win.w / 2 - bar / 2, win.y],
    [bar, win.h, win.x + win.w / 2 + bar / 2, win.y],
  ]) {
    const b = box(w, h, 0.4, theme.trim, 0.015)
    b.position.set(x, y, front + 0.18)
    machine.add(b)
  }

  // --- The keypad panel: a little screen, the keys, and a legend of what each letter is ---
  const panelX = 0.84
  const light = box(0.2, 0.08, 0.06, '#3b2416', 0.015)
  light.position.set(panelX, 3.22, front + 0.03)
  machine.add(light)

  const screen = canvasTexture(256, 96, () => {})
  keep(screen.tex)
  function showOnScreen(text: string, colour = COLOURS.screenText) {
    const { ctx, canvas } = screen
    ctx.fillStyle = COLOURS.screen
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = colour
    ctx.font = 'bold 52px "Courier Prime", ui-monospace, monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(text, canvas.width / 2, canvas.height / 2 + 3)
    screen.tex.needsUpdate = true
  }
  const screenBox = inked(new THREE.BoxGeometry(0.56, 0.2, 0.04), [toon(COLOURS.screen), toon(COLOURS.screen), toon(COLOURS.screen), toon(COLOURS.screen), toon('#ffffff', { map: screen.tex, emissive: '#0a1408' }), toon(COLOURS.screen)], 0.015)
  screenBox.position.set(panelX, 3.0, front + 0.03)
  machine.add(screenBox)

  // The keys: the row letters, then slot numbers, then "?" (surprise), "←" (rub out) and "⏎" (go).
  const KEYS = [...LETTERS, ...Array.from({ length: SLOTS }, (_, i) => String(i + 1)), '?', '←', '⏎']
  const keys: THREE.Mesh[] = []
  const keySize = 0.155
  const keyGap = 0.185
  KEYS.forEach((label, i) => {
    const col = i % 3
    const row = Math.floor(i / 3)
    const letterRow = LETTERS.indexOf(label)
    const face = letterRow >= 0 ? cats[letterRow].colour : label === '⏎' ? '#9fd46a' : COLOURS.key
    const tex = keep(centredText(label, face, labelOn(face), 'bold 80px "Courier Prime", ui-monospace, monospace', 128, 128))
    const side = toon(face)
    const k = inked(new THREE.BoxGeometry(keySize, keySize, 0.06), [side, side, side, side, toon('#ffffff', { map: tex }), side], 0.012)
    k.position.set(panelX + (col - 1) * keyGap, 2.75 - row * keyGap, front + 0.04)
    k.userData.key = label
    machine.add(k)
    keys.push(k)
  })
  const keypadBottom = 2.75 - (Math.ceil(KEYS.length / 3) - 1) * keyGap - keySize / 2

  // The legend under the keys: each letter with its category, drawn big and bold so it can be read
  // in the keypad close-up.
  const legendWidth = 0.66
  const legendHeight = 0.15 * cats.length + 0.06
  const legendTex = keep(
    canvasTexture(640, Math.round(640 * (legendHeight / legendWidth)), (ctx) => {
      const { width, height } = ctx.canvas
      ctx.fillStyle = COLOURS.glass
      ctx.fillRect(0, 0, width, height)
      ctx.font = 'bold 76px "Courier Prime", ui-monospace, monospace'
      ctx.textBaseline = 'middle'
      const line = (height - 24) / cats.length
      cats.forEach((cat, i) => {
        const y = 12 + line * (i + 0.5)
        ctx.fillStyle = cat.colour
        ctx.fillRect(14, y - 38, 76, 76)
        ctx.fillStyle = labelOn(cat.colour)
        ctx.fillText(LETTERS[i], 29, y + 4)
        ctx.fillStyle = INK
        ctx.fillText(cat.name, 108, y + 4)
      })
    }).tex,
  )
  const legend = inked(new THREE.BoxGeometry(legendWidth, legendHeight, 0.02), [toon(COLOURS.glass), toon(COLOURS.glass), toon(COLOURS.glass), toon(COLOURS.glass), toon('#ffffff', { map: legendTex }), toon(COLOURS.glass)], 0.012)
  legend.position.set(panelX + 0.02, keypadBottom - 0.06 - legendHeight / 2, front + 0.02)
  machine.add(legend)

  // --- The chute, with a flap that hangs from its top edge so it can swing open ---
  const chute = box(1.0, 0.5, 0.06, theme.chute, 0.02)
  chute.position.set(-0.2, 0.55, front + 0.02)
  machine.add(chute)
  const flapPivot = new THREE.Group()
  flapPivot.position.set(-0.2, 0.76, front + 0.07)
  const flap = box(0.9, 0.42, 0.04, theme.trim, 0.015)
  flap.position.y = -0.21
  flapPivot.add(flap)
  machine.add(flapPivot)

  // The capsule that comes out.
  const vended = makeCapsule(cats[0].colour)
  vended.scale.setScalar(1.6)
  vended.visible = false
  scene.add(vended)
  const vendedTop = vended.children[0] as THREE.Mesh

  // --- Sizing: draw at a fraction of the screen's pixels, so it looks like pixel art ---
  let pixelSize = 2
  // Zoomed in, draw finer, so the pixels stay about the same size on the machine (and small text
  // like the legend can be read in the keypad close-up).
  let drawnAt = 0
  const scaleForZoom = () => Math.max(1, pixelSize / Math.max(1, camera.zoom))
  function resize() {
    const { clientWidth: w, clientHeight: h } = container
    drawnAt = scaleForZoom()
    renderer.setPixelRatio(1 / drawnAt)
    renderer.setSize(w, h)
    const aspect = w / h
    Object.assign(camera, { left: -view.zoom * aspect, right: view.zoom * aspect, top: view.zoom, bottom: -view.zoom, near: 0.1, far: 100 })
    camera.updateProjectionMatrix()
  }
  resize()
  const ro = new ResizeObserver(resize)
  ro.observe(container)

  // Drag to turn the camera around the machine, scroll or pinch to zoom. It can't go under the floor.
  const controls = new OrbitControls(camera, renderer.domElement)
  controls.target.copy(lookAt)
  controls.enableDamping = true
  controls.enablePan = false
  controls.enableZoom = true
  controls.minZoom = 0.6
  controls.maxZoom = 2.5
  controls.maxPolarAngle = Math.PI / 2 - 0.05
  controls.update()
  // In a page, a plain scroll wheel scrolls the page; pinching on a trackpad (or ctrl + wheel) zooms.
  const onWheel = (e: WheelEvent) => {
    if (opts.embedded && !e.ctrlKey) e.stopImmediatePropagation()
  }
  renderer.domElement.addEventListener('wheel', onWheel, { capture: true })

  // The keypad's top-right corner, for pointing at it from the page.
  const keypadCorner = new THREE.Vector3(panelX + 0.3, 2.95, front + 0.05)

  // --- Camera moves: in close to the keypad when asked (the keypad button), and back to the
  // starting view, which already shows the whole vend. Dragging or zooming yourself stops any move. ---
  const homeShot = { target: lookAt.clone(), offset: camera.position.clone().sub(lookAt), zoom: opts.embedded ? 1.05 : 1 }
  camera.zoom = homeShot.zoom
  camera.updateProjectionMatrix()
  const SHOTS = {
    home: homeShot,
    // Face the keypad, from just a little above and to the right, like standing at the machine.
    keypad: { target: new THREE.Vector3(panelX, 2.0, front), offset: new THREE.Vector3(1.5, 1.8, 15.5), zoom: 2.3 },
  }
  type Shot = (typeof SHOTS)['home']
  let shot: keyof typeof SHOTS | 'free' = 'home'
  let move: gsap.core.Tween | null = null
  function fly(to: keyof typeof SHOTS | Shot, duration = 0.8) {
    if (shot === to) return
    shot = typeof to === 'string' ? to : 'free'
    move?.kill()
    const s = typeof to === 'string' ? SHOTS[to] : to
    const from = { target: controls.target.clone(), offset: camera.position.clone().sub(controls.target), zoom: camera.zoom }
    const p = { k: 0 }
    const apply = () => {
      controls.target.lerpVectors(from.target, s.target, p.k)
      camera.position.copy(controls.target).add(from.offset.clone().lerp(s.offset, p.k))
      camera.zoom = from.zoom + (s.zoom - from.zoom) * p.k
      camera.updateProjectionMatrix()
    }
    if (opts.reducedMotion || duration === 0) {
      p.k = 1
      apply()
      return
    }
    move = gsap.to(p, { k: 1, duration, ease: 'power2.inOut', onUpdate: apply, onComplete: () => void (move = null) })
  }
  // Before a vend, make sure the drop and roll will be in view. From the keypad close-up, go back to
  // the start view. If you've turned the machine yourself, keep your angle as far as possible: just
  // move and zoom out to fit the floor in front, and if the chute is hidden (you're at the side or
  // round the back), turn only as far as needed to see the front.
  const MAX_TURN = THREE.MathUtils.degToRad(55)
  function frameVend() {
    if (shot !== 'free') return fly('home', 0.6)
    const offset = camera.position.clone().sub(controls.target)
    const turn = Math.atan2(offset.x, offset.z) // 0 = straight at the front
    if (Math.abs(turn) > MAX_TURN) offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), Math.sign(turn) * MAX_TURN - turn)
    fly({ target: homeShot.target, offset, zoom: Math.min(camera.zoom, homeShot.zoom) }, 0.7)
  }
  const takeOver = () => {
    move?.kill()
    move = null
    shot = 'free'
  }
  // A click on a key isn't taking over the camera; only a real drag (or a pinch/zoom) is. Otherwise
  // clicking keys in the close-up would stop the camera going back to the start view on a vend.
  const onControlStart = () => {
    if (!downAt) takeOver()
  }
  controls.addEventListener('start', onControlStart)

  // --- Typing a code: on the machine's keys (click them) or on your keyboard ---
  let typed = ''
  const showTyped = () => showOnScreen(typed.padEnd(2, '_'))
  showTyped()

  function press(label: string) {
    const k = keys.find((key) => key.userData.key === label)
    if (k) gsap.fromTo(k.position, { z: front + 0.01 }, { z: front + 0.04, duration: 0.15, ease: 'power2.out' })
    if (label === '?') return vend()
    if (label === '←') typed = typed.slice(0, -1)
    else if (label === '⏎') return vend(typed)
    // A letter starts a new code; a number finishes it.
    else if (LETTERS.includes(label)) typed = label
    else if (typed.length === 1) typed += label
    showTyped()
  }

  // A click (not a drag) on a key presses it.
  const raycaster = new THREE.Raycaster()
  const ndc = new THREE.Vector2()
  let downAt: { x: number; y: number } | null = null
  const onDown = (e: PointerEvent) => (downAt = { x: e.clientX, y: e.clientY })
  const onMove = (e: PointerEvent) => {
    if (downAt && shot !== 'free' && Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 5) takeOver()
  }
  const onUp = (e: PointerEvent) => {
    const from = downAt
    downAt = null
    if (!from || Math.hypot(e.clientX - from.x, e.clientY - from.y) > 5) return
    const r = renderer.domElement.getBoundingClientRect()
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
    raycaster.setFromCamera(ndc, camera)
    const hit = raycaster.intersectObjects(keys, false)[0]
    if (hit) press(hit.object.userData.key as string)
  }
  // Capture, so it's set before the camera controls hear the same press.
  renderer.domElement.addEventListener('pointerdown', onDown, { capture: true })
  renderer.domElement.addEventListener('pointermove', onMove)
  renderer.domElement.addEventListener('pointerup', onUp)

  const onKey = (e: KeyboardEvent) => {
    if (e.target instanceof HTMLElement && e.target.closest('input, textarea, button')) return
    const k = e.key.toUpperCase()
    if (LETTERS.includes(k) || (/^[1-9]$/.test(k) && Number(k) <= SLOTS)) press(k)
    else if (e.key === 'Backspace') press('←')
    else if (e.key === 'Enter') press('⏎')
    else if (e.key === '?') press('?')
  }
  window.addEventListener('keydown', onKey)

  // Easter egg: no pointer or keys for a while and the sign changes its tune, until you're back.
  let lastActive = 0
  let nagging = false
  const clock = new THREE.Clock()
  const active = () => {
    lastActive = clock.getElapsedTime()
    if (nagging) {
      nagging = false
      led.setMessage(SIGN.main)
    }
  }
  const activity = ['pointermove', 'pointerdown', 'keydown', 'wheel'] as const
  activity.forEach((type) => window.addEventListener(type, active, { passive: true }))

  // --- The loop: a little idle life every frame ---
  renderer.setAnimationLoop(() => {
    const t = clock.getElapsedTime()
    if (!opts.reducedMotion) slots.flat().forEach((c, i) => (c.rotation.y = Math.sin(t * 1.5 + i) * 0.3))
    if (!nagging && t - lastActive > SIGN.idleAfter) {
      nagging = true
      led.setMessage(SIGN.idle)
    }
    led.update(t)
    // The light blinks slowly while waiting.
    ;(light.material as THREE.MeshToonMaterial).emissive.set(Math.sin(t * 3) > 0.6 ? '#3f7a22' : '#000000')
    controls.update()
    if (Math.abs(scaleForZoom() - drawnAt) > 0.25) resize()
    renderer.render(scene, camera)
    if (opts.onKeypad) {
      const p = keypadCorner.clone().project(camera)
      const toCamera = camera.position.clone().sub(controls.target)
      const facing = Math.abs(Math.atan2(toCamera.x, toCamera.z)) < THREE.MathUtils.degToRad(75)
      const onScreen = Math.abs(p.x) < 0.95 && Math.abs(p.y) < 0.95
      opts.onKeypad({ x: ((p.x + 1) / 2) * container.clientWidth, y: ((1 - p.y) / 2) * container.clientHeight, visible: facing && onScreen && shot !== 'keypad' })
    }
  })

  // --- The vend: the slot's capsule drops, the machine shudders, and it rolls out to you ---
  let tl: gsap.core.Timeline | null = null
  let emptied: THREE.Group | null = null
  function vend(code?: string) {
    let row: number
    let col: number
    if (code === undefined || code === '') {
      row = Math.floor(Math.random() * cats.length)
      col = Math.floor(Math.random() * SLOTS)
    } else {
      row = LETTERS.indexOf(code[0])
      // Just a letter picks any capsule in that row (the numbers don't mean anything yet).
      col = code.length === 1 ? Math.floor(Math.random() * SLOTS) : Number(code[1]) - 1
      if (row < 0 || !(col >= 0 && col < SLOTS)) {
        // Not a slot: say so, then go back to waiting.
        showOnScreen('??', '#ff7a52')
        typed = ''
        gsap.delayedCall(0.8, showTyped)
        return
      }
    }
    tl?.kill()
    frameVend()
    if (emptied) emptied.visible = true
    const cat = cats[row]
    ;(vendedTop.material as THREE.MeshToonMaterial).color.set(cat.colour)
    showOnScreen(`${LETTERS[row]}${col + 1}`)
    typed = ''

    // Back to the start: inside the chute, flap shut.
    vended.visible = false
    vended.position.set(-0.2, 0.55, front - 0.1)
    vended.rotation.set(0, 0, 0)
    machine.rotation.set(0, 0, 0)
    machine.position.set(0, 0, 0)
    flapPivot.rotation.set(0, 0, 0)

    const slot = slots[row][col]
    // Where it stops: out in front, a little to the left, so it stays in view with the machine.
    const rest = { x: -0.75, z: 2.5 }
    tl = gsap.timeline({ onComplete: () => gsap.delayedCall(1.2, showTyped) })
    // The capsule in that slot drops off its shelf, out of sight.
    tl.to(slot.position, { y: '-=0.3', duration: 0.25, ease: 'power2.in' })
      .set(slot, { visible: false })
      .set(slot.position, { y: '+=0.3' })
      .add(() => (emptied = slot))
      .to(machine.rotation, { z: 0.025, duration: 0.05, yoyo: true, repeat: 5, ease: 'sine.inOut' })
      .to(machine.position, { y: 0.06, duration: 0.08, yoyo: true, repeat: 3 }, '<')
      // The flap swings open and the capsule tumbles out.
      .to(flapPivot.rotation, { x: -1.2, duration: 0.18, ease: 'back.out(3)' })
      .set(vended, { visible: true })
      .to(vended.position, { z: front + 0.6, y: 0.26, duration: 0.25, ease: 'power2.in' }, '<')
      .to(flapPivot.rotation, { x: 0, duration: 0.4, ease: 'bounce.out' })
      // It rolls towards you, slowing down, with little bounces, then wobbles to a stop.
      .to(vended.position, { x: rest.x, z: rest.z, duration: 1.1, ease: 'power2.out' }, '<')
      .to(vended.rotation, { x: Math.PI * 4, duration: 1.1, ease: 'power2.out' }, '<')
      .to(vended.position, { y: 0.4, duration: 0.12, yoyo: true, repeat: 3, ease: 'sine.out' }, '<')
      .set(vended.rotation, { x: 0 })
      .to(vended.rotation, { z: 0.25, duration: 0.07, yoyo: true, repeat: 5 })
      .add(() => {
        showOnScreen(cat.name.slice(0, 7).toUpperCase(), cat.colour)
        led.flash(cat.sign)
      })
    // Less motion: just show the capsule where it lands.
    if (opts.reducedMotion) tl.progress(1)
  }

  return {
    vend,
    zoomBy(factor) {
      takeOver()
      const zoom = THREE.MathUtils.clamp(camera.zoom * factor, controls.minZoom, controls.maxZoom)
      if (opts.reducedMotion) {
        camera.zoom = zoom
        camera.updateProjectionMatrix()
      } else gsap.to(camera, { zoom, duration: 0.25, ease: 'power2.out', onUpdate: () => camera.updateProjectionMatrix() })
    },
    showKeypad() {
      shot = 'free'
      fly('keypad')
    },
    resetView() {
      shot = 'free'
      fly('home')
    },
    setPixelSize(size) {
      pixelSize = size
      resize()
    },
    dispose() {
      tl?.kill()
      ro.disconnect()
      move?.kill()
      controls.removeEventListener('start', onControlStart)
      controls.dispose()
      renderer.domElement.removeEventListener('wheel', onWheel, { capture: true })
      window.removeEventListener('keydown', onKey)
      activity.forEach((type) => window.removeEventListener(type, active))
      renderer.domElement.removeEventListener('pointerdown', onDown, { capture: true })
      renderer.domElement.removeEventListener('pointermove', onMove)
      renderer.domElement.removeEventListener('pointerup', onUp)
      renderer.setAnimationLoop(null)
      disposables.forEach((d) => d.dispose())
      renderer.dispose()
      renderer.domElement.remove()
    },
  }
}
