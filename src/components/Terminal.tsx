import { useEffect, useRef, useState } from 'react'
import type { CommandResult } from '../lib/commands'

type Line = { text: string; kind: 'input' | 'output' | 'error' }

type Props = {
  onRun: (input: string) => CommandResult
}

const WELCOME: Line[] = [{ text: 'type help to see commands', kind: 'output' }]

export function Terminal({ onRun }: Props) {
  const [lines, setLines] = useState<Line[]>(WELCOME)
  const [value, setValue] = useState('')
  const [history, setHistory] = useState<string[]>([])
  const [historyIndex, setHistoryIndex] = useState<number | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const endRef = useRef<HTMLDivElement>(null)

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
    if (!input.trim()) return
    setHistory((h) => [...h, input])

    const result = onRun(input)
    const echo: Line = { text: `> ${input}`, kind: 'input' }
    const out = result.output.map((text): Line => ({ text, kind: result.error ? 'error' : 'output' }))
    setLines((current) => (result.clear ? [] : [...current, echo, ...out]))
  }

  function browseHistory(step: -1 | 1) {
    if (history.length === 0) return
    const start = historyIndex ?? history.length
    const next = Math.min(Math.max(start + step, 0), history.length)
    setHistoryIndex(next === history.length ? null : next)
    setValue(next === history.length ? '' : history[next])
  }

  return (
    <section className="terminal" aria-label="Terminal" onClick={() => inputRef.current?.focus()}>
      <div className="terminal__title">TERMINAL</div>
      <div className="terminal__log" role="log" aria-live="polite">
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
