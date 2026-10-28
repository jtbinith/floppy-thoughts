import { useEffect, useImperativeHandle, useRef, useState, type PointerEvent as ReactPointerEvent, type Ref } from 'react'
import type { CommandResult } from '../lib/commands'

type Line = { text: string; kind: 'input' | 'output' | 'error' }

// Lets the device buttons run a command or focus the terminal.
export type TerminalHandle = {
  run: (input: string) => void
  focus: () => void
  // For results that arrive later, e.g. a nudge from Datamuse.
  print: (lines: string[], error?: boolean) => void
}

type Props = {
  onRun: (input: string) => CommandResult
  ref?: Ref<TerminalHandle>
}

const WELCOME: Line[] = [{ text: 'type help to see commands', kind: 'output' }]

// Terminal height is a personal preference, so it's remembered separately from boards.
const HEIGHT_KEY = 'hunchhack:ui:terminal-height'
const DEFAULT_HEIGHT = 200
const MIN_HEIGHT = 90
const maxHeight = () => Math.round(window.innerHeight * 0.7)
const clampHeight = (h: number) => Math.round(Math.min(Math.max(h, MIN_HEIGHT), maxHeight()))

function savedHeight(): number {
  const saved = Number(localStorage.getItem(HEIGHT_KEY))
  return Number.isFinite(saved) && saved > 0 ? clampHeight(saved) : DEFAULT_HEIGHT
}

export function Terminal({ onRun, ref }: Props) {
  const [lines, setLines] = useState<Line[]>(WELCOME)
  const [value, setValue] = useState('')
  const [history, setHistory] = useState<string[]>([])
  const [historyIndex, setHistoryIndex] = useState<number | null>(null)
  const [height, setHeight] = useState(savedHeight)
  const inputRef = useRef<HTMLInputElement>(null)
  const endRef = useRef<HTMLDivElement>(null)

  function resizeTo(next: number) {
    const h = clampHeight(next)
    setHeight(h)
    localStorage.setItem(HEIGHT_KEY, String(h))
  }

  // Drag the top edge to resize, like the panel in VS Code.
  function startResize(event: ReactPointerEvent<HTMLDivElement>) {
    event.preventDefault()
    const startY = event.clientY
    const startHeight = height
    const handle = event.currentTarget
    handle.setPointerCapture(event.pointerId)
    const onMove = (e: PointerEvent) => resizeTo(startHeight + (startY - e.clientY))
    const onUp = () => {
      handle.removeEventListener('pointermove', onMove)
      handle.removeEventListener('pointerup', onUp)
    }
    handle.addEventListener('pointermove', onMove)
    handle.addEventListener('pointerup', onUp)
  }

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [lines])

  // Ctrl+` focuses the terminal, like VS Code.
  useEffect(() => {
    function onKey(e: globalThis.KeyboardEvent) {
      if (e.ctrlKey && e.key === '`') {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  function submit() {
    const input = value
    setValue('')
    setHistoryIndex(null)
    execute(input)
  }

  function execute(input: string) {
    if (!input.trim()) return
    setHistory((h) => [...h, input])

    const result = onRun(input)
    const echo: Line = { text: `> ${input}`, kind: 'input' }
    const out = result.output.map((text): Line => ({ text, kind: result.error ? 'error' : 'output' }))
    setLines((current) => (result.clear ? [] : [...current, echo, ...out]))
  }

  function print(text: string[], error = false) {
    setLines((current) => [...current, ...text.map((t): Line => ({ text: t, kind: error ? 'error' : 'output' }))])
  }

  useImperativeHandle(ref, () => ({ run: execute, focus: () => inputRef.current?.focus(), print }))

  function browseHistory(step: -1 | 1) {
    if (history.length === 0) return
    const start = historyIndex ?? history.length
    const next = Math.min(Math.max(start + step, 0), history.length)
    setHistoryIndex(next === history.length ? null : next)
    setValue(next === history.length ? '' : history[next])
  }

  return (
    <section className="terminal" aria-label="Terminal" style={{ height }}>
      <div
        className="terminal__resize"
        role="separator"
        aria-orientation="horizontal"
        aria-label="Resize terminal"
        aria-valuenow={height}
        aria-valuemin={MIN_HEIGHT}
        aria-valuemax={maxHeight()}
        tabIndex={0}
        title="Drag to resize · double-click to reset"
        onPointerDown={startResize}
        onDoubleClick={() => resizeTo(DEFAULT_HEIGHT)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowUp') resizeTo(height + 20)
          else if (e.key === 'ArrowDown') resizeTo(height - 20)
        }}
      />
      <div className="terminal__title" onClick={() => inputRef.current?.focus()}>
        TERMINAL
      </div>
      <div className="terminal__log" role="log" aria-live="polite" onClick={() => inputRef.current?.focus()}>
        {lines.map((line, i) => (
          <div key={i} className={`terminal__line terminal__line--${line.kind}`}>
            {line.text}
          </div>
        ))}
        <div ref={endRef} />
      </div>
      <form
        className="terminal__prompt"
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        <span aria-hidden="true">~ %</span>
        <input
          ref={inputRef}
          className="terminal__input"
          aria-label="Terminal command"
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowUp') {
              e.preventDefault()
              browseHistory(-1)
            } else if (e.key === 'ArrowDown') {
              e.preventDefault()
              browseHistory(1)
            }
          }}
        />
      </form>
    </section>
  )
}
