import { useEffect, useImperativeHandle, useRef, useState, type PointerEvent as ReactPointerEvent, type Ref } from 'react'
import { isHelpHeading, type CommandResult } from '../lib/commands'
import type { Completion } from '../lib/complete'
import { KEYS } from '../lib/keys'

type Line = { text: string; kind: 'input' | 'output' | 'error' }

// Lets the device buttons run a command or focus the terminal.
export type TerminalHandle = {
  run: (input: string) => void
  focus: () => void
  // For results that arrive later, e.g. a nudge from Datamuse.
  print: (lines: string[], error?: boolean) => void
  // Put text in the input, ready to finish off (from the commands tab).
  fill: (text: string) => void
}

type Props = {
  onRun: (input: string) => CommandResult
  // Tab completion: the completed input, plus choices to show when it's ambiguous.
  onComplete?: (input: string) => Completion
  // Esc: hand the keyboard back to the board.
  onEscape?: () => void
  // Whether you're typing a command (the line starts with "/"), so the board can show ids.
  onCommandMode?: (on: boolean) => void
  ref?: Ref<TerminalHandle>
}

const WELCOME: Line[] = [{ text: 'type a thought and press Enter to add it · commands start with / (try /help)', kind: 'output' }]

// Terminal height is a personal preference, so it's remembered separately from boards.
const HEIGHT_KEY = KEYS.terminalHeight
const DEFAULT_HEIGHT = 200
const MIN_HEIGHT = 90
const maxHeight = () => Math.round(window.innerHeight * 0.7)
const clampHeight = (h: number) => Math.round(Math.min(Math.max(h, MIN_HEIGHT), maxHeight()))

function savedHeight(): number {
  const saved = Number(localStorage.getItem(HEIGHT_KEY))
  return Number.isFinite(saved) && saved > 0 ? clampHeight(saved) : DEFAULT_HEIGHT
}

export function Terminal({ onRun, onComplete, onEscape, onCommandMode, ref }: Props) {
  const [lines, setLines] = useState<Line[]>(WELCOME)
  const [value, setValue] = useState('')
  const [history, setHistory] = useState<string[]>([])
  const [historyIndex, setHistoryIndex] = useState<number | null>(null)
  const [height, setHeight] = useState(savedHeight)
  const inputRef = useRef<HTMLInputElement>(null)
  const endRef = useRef<HTMLDivElement>(null)
  // Where to draw the underscore cursor (a column, less how far the input has scrolled), or null
  // when the input isn't focused or some text is selected.
  const [caret, setCaret] = useState<{ col: number; scroll: number } | null>(null)
  function syncCaret() {
    const input = inputRef.current
    if (!input || document.activeElement !== input || input.selectionStart !== input.selectionEnd) return setCaret(null)
    setCaret({ col: input.selectionStart ?? input.value.length, scroll: input.scrollLeft })
  }
  // Text set from code (history, tab completion) moves the cursor without a select event.
  useEffect(() => {
    const t = requestAnimationFrame(syncCaret)
    return () => cancelAnimationFrame(t)
  }, [value])

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

  const commandMode = value.trimStart().startsWith('/')
  useEffect(() => {
    onCommandMode?.(commandMode)
  }, [commandMode, onCommandMode])

  // Ctrl+` focuses the terminal, like VS Code. It checks the physical key, because on some
  // keyboard layouts that key doesn't report "`" while Ctrl is held. "/" from the board (anywhere
  // that isn't a text box) jumps here and starts a command, since commands start with "/".
  useEffect(() => {
    function onKey(e: globalThis.KeyboardEvent) {
      const typing = e.target instanceof Element && !!e.target.closest('input, textarea')
      const backtick = e.ctrlKey && (e.code === 'Backquote' || e.key === '`')
      // ":" works too, like vim's command line.
      const slash = (e.key === '/' || e.key === ':') && !typing && !e.ctrlKey && !e.metaKey && !e.altKey && !(e.target instanceof Element && e.target.closest('.panel, .popup'))
      if (backtick || slash) {
        e.preventDefault()
        if (slash) setValue((v) => (v ? v : '/'))
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

  useImperativeHandle(ref, () => ({
    run: execute,
    focus: () => inputRef.current?.focus(),
    print,
    fill: (text: string) => {
      setValue(text)
      setHistoryIndex(null)
      inputRef.current?.focus()
    },
  }))

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
          // Uppercase lines like "LINKS" head a group in the help, so they stand out.
          <div key={i} className={`terminal__line terminal__line--${line.kind}${line.kind === 'output' && isHelpHeading(line.text) ? ' terminal__line--heading' : ''}`}>
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
        <span className="terminal__field">
        <input
          ref={inputRef}
          className="terminal__input"
          aria-label="Terminal command"
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onSelect={syncCaret}
          onFocus={syncCaret}
          onBlur={() => setCaret(null)}
          onKeyDown={(e) => {
            if (e.key === 'Tab' && !e.shiftKey && onComplete) {
              // Stay in the terminal and complete, like a shell.
              e.preventDefault()
              const { value: completed, options, list } = onComplete(value)
              setValue(completed)
              if (options.length) print(list ? options : [`  ${options.join('   ')}`])
            } else if (e.ctrlKey && !e.metaKey && e.key.toLowerCase() === 'c') {
              // Ctrl+C cancels the line, like a shell. With text selected it copies as usual.
              const input = e.currentTarget
              if (input.selectionStart !== input.selectionEnd) return
              e.preventDefault()
              setLines((current) => [...current, { text: `> ${value}^C`, kind: 'input' }])
              setValue('')
              setHistoryIndex(null)
            } else if (e.key === 'Escape' && onEscape) {
              e.preventDefault()
              onEscape()
            } else if (e.key === 'ArrowUp') {
              e.preventDefault()
              browseHistory(-1)
            } else if (e.key === 'ArrowDown') {
              e.preventDefault()
              browseHistory(1)
            }
          }}
        />
          {caret && <i className="terminal__caret" aria-hidden="true" style={{ left: `calc(${caret.col}ch - ${caret.scroll}px)` }} />}
        </span>
      </form>
    </section>
  )
}
