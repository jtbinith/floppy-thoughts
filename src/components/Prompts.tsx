import { useState } from 'react'
import { MAX_NODE_TEXT, type Board } from '../lib/board'
import { findNode } from '../lib/boardOps'
import { summarise, summaryText } from '../lib/summary'
import { Dialog } from './Dialog'

// The small questions the board asks: a theme for a new board, whether to keep a chain
// connected when you delete from the middle of it, and the summary once you've found your idea.

export function ThemePrompt({ onTheme, onSkip }: { onTheme: (text: string) => void; onSkip: () => void }) {
  const [theme, setTheme] = useState('')
  return (
    <Dialog label="Got a theme?" onCancel={onSkip}>
      <form
        className="dialog__form"
        onSubmit={(e) => {
          e.preventDefault()
          if (theme.trim()) onTheme(theme)
          else onSkip()
        }}
      >
        <h2 className="dialog__title">Got a theme?</h2>
        <p className="dialog__text">A hackathon theme or a topic, like &quot;Time&quot;. It sits in the middle of your board. No theme is fine too.</p>
        <input
          className="dialog__input"
          aria-label="Main theme"
          value={theme}
          maxLength={MAX_NODE_TEXT}
          placeholder="e.g. Time"
          onChange={(e) => setTheme(e.target.value)}
        />
        <div className="popup__actions">
          <button type="submit" className="popup__stick" disabled={!theme.trim()}>
            set theme
          </button>
          <button type="button" className="popup__back" onClick={onSkip}>
            skip
          </button>
        </div>
      </form>
    </Dialog>
  )
}

// Asked when what you're deleting sits in the middle of a chain (A — B — C).
export function ChainPrompt({
  board,
  chains,
  onAnswer,
  onCancel,
}: {
  board: Board
  chains: { id: string; around: [string, string] }[]
  onAnswer: (reconnect: boolean) => void
  onCancel: () => void
}) {
  const name = (id: string) => `"${findNode(board, id)?.text ?? id}"`
  const [first] = chains
  return (
    <Dialog label="Keep the chain connected?" onCancel={onCancel}>
      <h2 className="dialog__title">Keep the chain connected?</h2>
      <p className="dialog__text">
        {chains.length === 1 ? (
          <>
            {name(first.id)} links {name(first.around[0])} and {name(first.around[1])}. Link those two to each other once it&apos;s gone?
          </>
        ) : (
          <>{chains.length} of the things you&apos;re deleting sit in the middle of a chain. Link up what was on either side of them?</>
        )}
      </p>
      <div className="popup__actions">
        <button type="button" className="popup__stick" onClick={() => onAnswer(true)} autoFocus>
          keep it connected
        </button>
        <button type="button" className="popup__back" onClick={() => onAnswer(false)}>
          just delete
        </button>
      </div>
    </Dialog>
  )
}

export function SummaryPopup({ board, onClose }: { board: Board; onClose: () => void }) {
  const [copied, setCopied] = useState(false)
  const summary = summarise(board)
  if (!summary) return null
  const text = summaryText(board, summary)
  return (
    <Dialog label="Your idea" onCancel={onClose} wide>
      <h2 className="dialog__title">you found your idea</h2>
      <p className="summary__idea">{summary.idea.text}</p>
      {summary.trails.length > 0 ? (
        <div className="summary__trails">
          <h3>how you got there</h3>
          <ol>
            {summary.trails.map((trail) => (
              <li key={trail[0].id}>
                {trail.map((n, i) => (
                  <span key={n.id}>
                    {i > 0 && <span className="summary__arrow"> → </span>}
                    <span className={`summary__step summary__step--${n.kind}`}>{n.text}</span>
                  </span>
                ))}
              </li>
            ))}
          </ol>
        </div>
      ) : (
        <p className="dialog__text">Link it to the notes that led you here to see the trail.</p>
      )}
      <div className="popup__actions">
        <button
          type="button"
          className="popup__stick"
          autoFocus
          onClick={() => {
            void navigator.clipboard.writeText(text).then(() => setCopied(true))
          }}
        >
          {copied ? 'copied ✓' : 'copy summary'}
        </button>
        <button type="button" className="popup__back" onClick={onClose}>
          keep brainstorming
        </button>
      </div>
    </Dialog>
  )
}
