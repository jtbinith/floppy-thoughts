import * as THREE from 'three'

// PROTOTYPE: the token version of the shrimp, to compare with the 3D one. Like a collectible
// pickup in a runner game: no coin, just the shrimp itself as a chunky, rounded object, floating,
// spinning and glowing. It's the flat shrimp glyph (the icon she picked) made thick, so it reads
// from any angle and from far away.
//
// The glyph is drawn flat, facing left:
//   - head: a half-moon dome with a flat bottom, and an eye
//   - body: a thick "C" curling round the back, cut into bands with grooves between
//   - tail: two lobes at the bottom front
//   - antennae: two lines from the nose/mouth that curve up in front of the face and run straight back
//   - legs: three little curls under the head

const COLOURS = {
  shrimp: '#ff7a52',
  band: '#ef6a44',
  eye: '#2f2526',
  glow: '#ffb070',
  sparkle: '#fff1b8',
}

// How thick the token is, and how round its edges are.
const DEPTH = 0.16
const BEVEL = 0.05
// How big the eye dot is (its radius).
const EYE = 0.085

type Helpers = {
  inked: (geometry: THREE.BufferGeometry, material: THREE.Material | THREE.Material[], outline?: number) => THREE.Mesh
  toon: (color: string) => THREE.MeshToonMaterial
  keep: <T extends { dispose: () => void }>(thing: T) => T
  tube: (points: [number, number, number][], radius: number, color: string, parent: THREE.Object3D) => THREE.Mesh
}

const deg = THREE.MathUtils.degToRad

export function buildToken({ inked, toon, keep, tube }: Helpers) {
  const group = new THREE.Group()
  const token = new THREE.Group()
  group.add(token)

  // A flat shape made thick with rounded edges, centred front to back.
  // Small parts (the legs) get a thinner body and a smaller rounding, or they'd swell into blobs.
  const extrude = (shape: THREE.Shape, depth = DEPTH, bevel = BEVEL) => {
    const g = keep(new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel * 0.8, bevelSegments: 3, curveSegments: 18 }))
    g.translate(0, 0, -depth / 2)
    return g
  }
  const add = (shape: THREE.Shape, color: string, outline = 0.02, depth = DEPTH, bevel = BEVEL) => {
    const m = inked(extrude(shape, depth, bevel), toon(color), outline)
    token.add(m)
    return m
  }

  // The body: a thick "C" round a centre point, in bands from just behind the head, clockwise
  // round the back, to the bottom front. Each band a little thinner than the last; the gaps
  // between them are wide enough to stay as grooves once the edges are rounded.
  const C = { x: 0.1, y: -0.02, inner: 0.17 }
  const BANDS = [
    { from: 120, to: 64, outer: 0.4 },
    { from: 57, to: 8, outer: 0.4 },
    { from: 1, to: -50, outer: 0.38 },
    { from: -57, to: -106, outer: 0.35 },
    { from: -113, to: -160, outer: 0.31 },
  ]
  BANDS.forEach((b, i) => {
    const s = new THREE.Shape()
    s.absarc(C.x, C.y, b.outer, deg(b.from), deg(b.to), true)
    s.absarc(C.x, C.y, C.inner, deg(b.to), deg(b.from), false)
    s.closePath()
    add(s, i % 2 ? COLOURS.band : COLOURS.shrimp)
  })

  // The tail: one fan growing out of the end of the curl. It starts as a narrow neck overlapping
  // the last band, flares forwards (left), and splits into two lobes with a notch between. It sits
  // low enough to leave a clear gap under the legs.
  const tail = new THREE.Shape()
  tail.moveTo(-0.08, -0.15)
  tail.quadraticCurveTo(-0.28, -0.13, -0.42, -0.07) // along the top to the upper tip
  tail.quadraticCurveTo(-0.37, -0.18, -0.35, -0.22) // back in to the notch
  tail.quadraticCurveTo(-0.37, -0.26, -0.44, -0.36) // out to the lower tip
  tail.quadraticCurveTo(-0.28, -0.31, -0.16, -0.26) // along the bottom back to the neck
  tail.closePath()
  add(tail, COLOURS.shrimp)

  // The head: a half-moon dome, flat along the bottom, over the front of the body.
  const head = new THREE.Shape()
  head.moveTo(0.09, 0.12)
  head.absarc(-0.17, 0.12, 0.26, 0, Math.PI, false)
  head.closePath()
  add(head, COLOURS.shrimp)

  // The eye: a short rod right through the head, its flat ends showing as a full round dot on
  // both sides. (A ball only pokes its tip out, so the dot looks much smaller than it is.)
  const eye = inked(keep(new THREE.CylinderGeometry(EYE, EYE, DEPTH + BEVEL * 2 + 0.02, 20)), toon(COLOURS.eye), 0.012)
  eye.rotation.x = Math.PI / 2
  eye.position.set(-0.24, 0.24, 0)
  token.add(eye)

  // Antennae: from the nose/mouth at the front of the head, sweeping forwards and up in front of
  // the face, then over the top and straight back. Fat enough to read as solid, side by side
  // through the middle of the token's thickness.
  tube([[-0.43, 0.18, 0], [-0.56, 0.26, 0], [-0.62, 0.42, 0], [-0.55, 0.56, 0], [-0.38, 0.62, 0], [0.1, 0.62, 0], [0.52, 0.62, 0]], 0.04, COLOURS.shrimp, token)
  tube([[-0.42, 0.14, 0], [-0.52, 0.21, 0], [-0.56, 0.35, 0], [-0.5, 0.47, 0], [-0.36, 0.53, 0], [0.1, 0.53, 0], [0.46, 0.53, 0]], 0.04, COLOURS.shrimp, token)

  // Legs: three short rounded nubs hanging from under the head, leaning forwards, in the gap
  // above the tail. Thinner than the rest, but sturdy enough to read at pixel size.
  for (const x of [-0.31, -0.21, -0.11]) {
    const leg = new THREE.Shape()
    const w = 0.03
    const len = 0.12
    leg.absarc(0, 0, w, 0, Math.PI, false)
    leg.absarc(0, -len, w, Math.PI, Math.PI * 2, false)
    leg.closePath()
    const m = add(leg, COLOURS.band, 0.014, DEPTH * 0.9, 0.02)
    m.position.set(x, 0.12, 0)
    m.rotation.z = -0.45
  }

  // Bigger than the shrimp model, centred on its spin.
  token.scale.setScalar(1.35)
  token.position.y = 0.1

  // A soft glow behind it, always facing you, like a pickup waiting to be grabbed.
  const glowCanvas = document.createElement('canvas')
  glowCanvas.width = glowCanvas.height = 64
  const ctx = glowCanvas.getContext('2d')!
  const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
  grad.addColorStop(0, `${COLOURS.glow}aa`)
  grad.addColorStop(0.5, `${COLOURS.glow}33`)
  grad.addColorStop(1, `${COLOURS.glow}00`)
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, 64, 64)
  const glowTex = keep(new THREE.CanvasTexture(glowCanvas))
  glowTex.colorSpace = THREE.SRGBColorSpace
  const glow = new THREE.Sprite(keep(new THREE.SpriteMaterial({ map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })))
  glow.scale.setScalar(2.2)
  glow.renderOrder = -1
  group.add(glow)

  // Sparkles: little pixel-art four-point stars dotted round it, each twinkling in and out at its
  // own pace. Drawn on a tiny canvas and kept blocky (no smoothing), so they match the pixel look.
  const STAR = [
    '...#...',
    '...#...',
    '..###..',
    '#######',
    '..###..',
    '...#...',
    '...#...',
  ]
  const starCanvas = document.createElement('canvas')
  starCanvas.width = starCanvas.height = STAR.length
  const sctx = starCanvas.getContext('2d')!
  sctx.fillStyle = COLOURS.sparkle
  STAR.forEach((row, y) => [...row].forEach((c, x) => c === '#' && sctx.fillRect(x, y, 1, 1)))
  const starTex = keep(new THREE.CanvasTexture(starCanvas))
  starTex.colorSpace = THREE.SRGBColorSpace
  starTex.magFilter = THREE.NearestFilter
  starTex.minFilter = THREE.NearestFilter
  starTex.generateMipmaps = false
  const starMat = keep(new THREE.SpriteMaterial({ map: starTex, transparent: true, depthWrite: false }))
  // Where each one sits (angle round the token, distance out, height) and its twinkle timing.
  const SPARKLES = [
    { angle: 20, out: 0.95, y: 0.45, size: 0.22, speed: 2.1, phase: 0 },
    { angle: 75, out: 1.0, y: -0.35, size: 0.16, speed: 2.7, phase: 1.3 },
    { angle: 140, out: 0.9, y: 0.6, size: 0.18, speed: 1.8, phase: 2.4 },
    { angle: 200, out: 1.05, y: -0.1, size: 0.2, speed: 2.4, phase: 0.7 },
    { angle: 260, out: 0.95, y: 0.3, size: 0.14, speed: 3.0, phase: 3.1 },
    { angle: 315, out: 1.0, y: -0.5, size: 0.17, speed: 2.2, phase: 4.2 },
  ]
  const sparkles = SPARKLES.map((p) => {
    const sp = new THREE.Sprite(starMat)
    const a = deg(p.angle)
    sp.position.set(Math.cos(a) * p.out, p.y, Math.sin(a) * p.out)
    sp.scale.setScalar(p.size)
    group.add(sp)
    return { sp, ...p }
  })

  // Floating off the floor.
  group.position.y = 1.15

  return {
    group,
    // Spinning slowly and bobbing, the glow gently pulsing and the sparkles twinkling. Still and turned to show its side when motion
    // is reduced.
    update(t: number, reducedMotion: boolean) {
      if (reducedMotion) {
        token.rotation.y = 0.4
        return
      }
      token.rotation.y = t * 0.9
      group.position.y = 1.15 + Math.sin(t * 2.5) * 0.08
      glow.scale.setScalar(2.2 + Math.sin(t * 3) * 0.12)
      // Each sparkle grows in and shrinks away, and the ring of them drifts slowly round.
      for (const s of sparkles) {
        const twinkle = Math.max(0, Math.sin(t * s.speed + s.phase))
        s.sp.scale.setScalar(s.size * twinkle)
        const a = deg(s.angle) + t * 0.3
        s.sp.position.x = Math.cos(a) * s.out
        s.sp.position.z = Math.sin(a) * s.out
      }
    },
  }
}
