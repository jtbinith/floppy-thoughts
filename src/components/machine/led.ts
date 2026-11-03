import * as THREE from 'three'

// The machine's sign: a dot-matrix LED display with words scrolling past in a loop, like the
// signs on old vending machines and bus stops. Lit dots glow amber; unlit ones are dim.

// A classic 5 × 7 LED font: each letter is seven rows, each row five dots (as bits, left to right).
const FONT: Record<string, number[]> = {
  A: [0x0e, 0x11, 0x11, 0x1f, 0x11, 0x11, 0x11],
  B: [0x1e, 0x11, 0x11, 0x1e, 0x11, 0x11, 0x1e],
  C: [0x0e, 0x11, 0x10, 0x10, 0x10, 0x11, 0x0e],
  D: [0x1e, 0x11, 0x11, 0x11, 0x11, 0x11, 0x1e],
  E: [0x1f, 0x10, 0x10, 0x1e, 0x10, 0x10, 0x1f],
  F: [0x1f, 0x10, 0x10, 0x1e, 0x10, 0x10, 0x10],
  G: [0x0e, 0x11, 0x10, 0x17, 0x11, 0x11, 0x0f],
  H: [0x11, 0x11, 0x11, 0x1f, 0x11, 0x11, 0x11],
  I: [0x0e, 0x04, 0x04, 0x04, 0x04, 0x04, 0x0e],
  J: [0x07, 0x02, 0x02, 0x02, 0x02, 0x12, 0x0c],
  K: [0x11, 0x12, 0x14, 0x18, 0x14, 0x12, 0x11],
  L: [0x10, 0x10, 0x10, 0x10, 0x10, 0x10, 0x1f],
  M: [0x11, 0x1b, 0x15, 0x15, 0x11, 0x11, 0x11],
  N: [0x11, 0x11, 0x19, 0x15, 0x13, 0x11, 0x11],
  O: [0x0e, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0e],
  P: [0x1e, 0x11, 0x11, 0x1e, 0x10, 0x10, 0x10],
  Q: [0x0e, 0x11, 0x11, 0x11, 0x15, 0x12, 0x0d],
  R: [0x1e, 0x11, 0x11, 0x1e, 0x14, 0x12, 0x11],
  S: [0x0f, 0x10, 0x10, 0x0e, 0x01, 0x01, 0x1e],
  T: [0x1f, 0x04, 0x04, 0x04, 0x04, 0x04, 0x04],
  U: [0x11, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0e],
  V: [0x11, 0x11, 0x11, 0x11, 0x11, 0x0a, 0x04],
  W: [0x11, 0x11, 0x11, 0x15, 0x15, 0x15, 0x0a],
  X: [0x11, 0x11, 0x0a, 0x04, 0x0a, 0x11, 0x11],
  Y: [0x11, 0x11, 0x0a, 0x04, 0x04, 0x04, 0x04],
  Z: [0x1f, 0x01, 0x02, 0x04, 0x08, 0x10, 0x1f],
  '0': [0x0e, 0x11, 0x13, 0x15, 0x19, 0x11, 0x0e],
  '1': [0x04, 0x0c, 0x04, 0x04, 0x04, 0x04, 0x0e],
  '2': [0x0e, 0x11, 0x01, 0x02, 0x04, 0x08, 0x1f],
  '3': [0x1f, 0x02, 0x04, 0x02, 0x01, 0x11, 0x0e],
  '4': [0x02, 0x06, 0x0a, 0x12, 0x1f, 0x02, 0x02],
  '5': [0x1f, 0x10, 0x1e, 0x01, 0x01, 0x11, 0x0e],
  '6': [0x06, 0x08, 0x10, 0x1e, 0x11, 0x11, 0x0e],
  '7': [0x1f, 0x01, 0x02, 0x04, 0x08, 0x08, 0x08],
  '8': [0x0e, 0x11, 0x11, 0x0e, 0x11, 0x11, 0x0e],
  '9': [0x0e, 0x11, 0x11, 0x0f, 0x01, 0x02, 0x0c],
  ' ': [0, 0, 0, 0, 0, 0, 0],
  ':': [0x00, 0x0c, 0x0c, 0x00, 0x0c, 0x0c, 0x00],
  '!': [0x04, 0x04, 0x04, 0x04, 0x04, 0x00, 0x04],
  '?': [0x0e, 0x11, 0x01, 0x02, 0x04, 0x00, 0x04],
  '.': [0x00, 0x00, 0x00, 0x00, 0x00, 0x0c, 0x0c],
  '-': [0x00, 0x00, 0x00, 0x1f, 0x00, 0x00, 0x00],
  // A little sparkle, used between messages.
  '*': [0x00, 0x04, 0x15, 0x0e, 0x15, 0x04, 0x00],
}

export const LED = { cols: 50, rows: 9 }
const DOT = 8 // pixels per dot on the texture
const GAP = 12 // blank columns between loops

// Turns text into columns of dots (each column is seven bits, top to bottom).
function columnsOf(text: string) {
  const cols: number[] = []
  for (const ch of text.toUpperCase()) {
    const glyph = FONT[ch] ?? FONT['?']
    for (let x = 0; x < 5; x++) {
      let col = 0
      for (let y = 0; y < 7; y++) if (glyph[y] & (1 << (4 - x))) col |= 1 << y
      cols.push(col)
    }
    cols.push(0)
  }
  return cols
}

export function createLedSign(messages: string[], opts: { reducedMotion: boolean }) {
  const canvas = document.createElement('canvas')
  canvas.width = LED.cols * DOT
  canvas.height = LED.rows * DOT
  const ctx = canvas.getContext('2d')!
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.generateMipmaps = false
  texture.minFilter = THREE.LinearFilter
  texture.magFilter = THREE.NearestFilter

  let loop = columnsOf(messages.join(' * '))
  let offset = -LED.cols
  let lastStep = 0
  // A word to blink in the middle for a moment (e.g. what you just got), then back to the loop.
  let blink: { strip: number[]; start: number } | null = null

  function draw(strip: number[], start: number) {
    ctx.fillStyle = '#140b07'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    for (let x = 0; x < LED.cols; x++) {
      const i = start + x
      const col = i >= 0 && i < strip.length ? strip[i] : 0
      for (let y = 0; y < LED.rows; y++) {
        // The text sits on rows 1–7, with a dark row above and below.
        const lit = y >= 1 && y <= 7 && (col >> (y - 1)) & 1
        const cx = x * DOT + DOT / 2
        const cy = y * DOT + DOT / 2
        ctx.fillStyle = lit ? '#ffb347' : '#3a2214'
        ctx.beginPath()
        ctx.arc(cx, cy, DOT * 0.38, 0, Math.PI * 2)
        ctx.fill()
        if (lit) {
          ctx.fillStyle = '#fff1c4'
          ctx.fillRect(cx - 1, cy - 1, 2, 2)
        }
      }
    }
    texture.needsUpdate = true
  }

  // Centred, not moving, for people who ask for less motion.
  function drawStill(text: string) {
    const strip = columnsOf(text)
    draw(strip, -Math.floor((LED.cols - strip.length + 1) / 2))
  }

  if (opts.reducedMotion) drawStill('PICK ONE')
  else draw(loop, offset)

  return {
    texture,
    // Moves the text along one column at a time, about twenty columns a second.
    update(seconds: number) {
      if (opts.reducedMotion) return
      if (blink) {
        // Three quick blinks, then it stays lit for a moment before the loop comes back.
        if (blink.start < 0) blink.start = seconds
        const t = seconds - blink.start
        if (t > 2.6) {
          blink = null
          offset = -LED.cols
        } else {
          const on = t > 1.2 || Math.floor(t / 0.2) % 2 === 0
          draw(on ? blink.strip : [], -Math.floor((LED.cols - blink.strip.length + 1) / 2))
        }
        return
      }
      if (seconds - lastStep < 0.05) return
      lastStep = seconds
      offset++
      if (offset >= loop.length + GAP) offset = -LED.cols
      draw(loop, offset)
    },
    // Swap what scrolls (starting from the right-hand edge again).
    setMessage(text: string) {
      loop = columnsOf(text)
      offset = -LED.cols
    },
    // Blink a word in the middle (eight letters fit), then carry on with the loop.
    flash(text: string) {
      if (opts.reducedMotion) return drawStill(text.slice(0, 8))
      blink = { strip: columnsOf(text.slice(0, 8)), start: -1 }
    },
    dispose: () => texture.dispose(),
  }
}
