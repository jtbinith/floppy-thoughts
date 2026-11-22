import type { DragEvent, TouchEvent as ReactTouchEvent } from 'react'

// Dragging a board or folder onto a folder (or a step of the folder path), and the counts on a
// folder card.
export const DRAGGED = 'application/x-floppy-thing'
export type Dragged = { kind: 'board' | 'folder'; id: string }
export const dragData = (e: DragEvent): Dragged | null => {
  try {
    return JSON.parse(e.dataTransfer.getData(DRAGGED)) as Dragged
  } catch {
    return null
  }
}

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`
export const countOf = (boards: number, folders: number) =>
  boards === 0 && folders === 0 ? 'empty' : [boards && plural(boards, 'board'), folders && plural(folders, 'folder')].filter(Boolean).join(' · ')

// Touch screens have no drag and drop, so there it's press and hold, then drag: after a moment
// the board (or folder) lifts, follows your finger, and goes in the folder you let go over. A
// quick swipe still scrolls the page; a tap still opens it. Anything marked `data-drop` (a folder
// id, or "top" for my boards) takes a drop.
const HOLD_MS = 350
export const TOP = 'top'

export function holdToDrag(e: ReactTouchEvent, thing: Dragged, label: string, drop: (thing: Dragged, into: string | null) => void) {
  if (e.touches.length !== 1) return
  const start = { x: e.touches[0].clientX, y: e.touches[0].clientY }
  let ghost: HTMLElement | null = null
  let over: Element | null = null
  const place = (x: number, y: number) => ghost && (ghost.style.transform = `translate(${x}px, ${y}px)`)
  const lift = () => {
    ghost = document.createElement('div')
    ghost.className = 'drag-ghost'
    ghost.textContent = label
    document.body.append(ghost)
    document.body.classList.add('dragging-thing')
    place(start.x, start.y)
    navigator.vibrate?.(10)
    scrolling = requestAnimationFrame(scroll)
  }
  const timer = window.setTimeout(lift, HOLD_MS)
  // Held near the top or bottom of the screen, the page scrolls, so a folder further up or down
  // can be reached.
  let finger = start
  let scrolling = 0
  const EDGE = 60
  const scroll = () => {
    const speed = finger.y < EDGE ? -(EDGE - finger.y) / 4 : finger.y > innerHeight - EDGE ? (finger.y - (innerHeight - EDGE)) / 4 : 0
    if (speed) {
      window.scrollBy(0, speed)
      hover()
    }
    scrolling = requestAnimationFrame(scroll)
  }
  const hover = () => {
    const now = target(finger.x, finger.y)
    if (now !== over) {
      over?.classList.remove('drop-over')
      now?.classList.add('drop-over')
      over = now
    }
  }
  const target = (x: number, y: number) => document.elementFromPoint(x, y)?.closest('[data-drop]') ?? null
  const move = (ev: TouchEvent) => {
    const t = ev.touches[0]
    if (!ghost) {
      // Moved before it lifted: that's a scroll.
      if (Math.hypot(t.clientX - start.x, t.clientY - start.y) > 8) end()
      return
    }
    ev.preventDefault()
    finger = { x: t.clientX, y: t.clientY }
    place(t.clientX, t.clientY)
    hover()
  }
  const up = (ev: TouchEvent) => {
    if (ghost) {
      // Letting go after a drag isn't a tap: this stops the browser turning it into a click on
      // whatever's under the finger.
      ev.preventDefault()
      const into = over?.getAttribute('data-drop')
      if (into && into !== thing.id) drop(thing, into === TOP ? null : into)
    }
    end()
  }
  const noMenu = (ev: Event) => ghost && ev.preventDefault()
  const end = () => {
    clearTimeout(timer)
    cancelAnimationFrame(scrolling)
    ghost?.remove()
    ghost = null
    over?.classList.remove('drop-over')
    document.body.classList.remove('dragging-thing')
    window.removeEventListener('touchmove', move)
    window.removeEventListener('touchend', up)
    window.removeEventListener('touchcancel', end)
    window.removeEventListener('contextmenu', noMenu)
  }
  window.addEventListener('touchmove', move, { passive: false })
  window.addEventListener('touchend', up, { passive: false })
  window.addEventListener('touchcancel', end)
  window.addEventListener('contextmenu', noMenu)
}

// With a mouse: while something's being dragged, every folder it could go in lights up.
export const dragStarted = () => document.body.classList.add('dragging-thing')
export const dragEnded = () => document.body.classList.remove('dragging-thing')
