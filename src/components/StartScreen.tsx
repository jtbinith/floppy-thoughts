import { useState } from 'react'
import type { Spark } from '../lib/sparks/deal'
import { VendingMachine } from './VendingMachine'

export type NewBoardRequest = { theme?: string; name?: string; sparks: Spark[] }

type Props = {
  onCreate: (request: NewBoardRequest) => void
  onCancel?: () => void
}

const MAX_THEME = 60

// "New board": blank (3 sparks) or theme (your theme, locked, plus 2 sparks).
export function StartScreen({ onCreate, onCancel }: Props) {
  const [mode, setMode] = useState<'blank' | 'theme'>('blank')
  const [theme, setTheme] = useState('')
  const [name, setName] = useState('')
  const [step, setStep] = useState<'setup' | 'machines'>('setup')
  const themeMissing = mode === 'theme' && !theme.trim()
  const themeText = mode === 'theme' ? theme.trim() : undefined

  if (step === 'machines') {
    return (
      <div className="device__screen">
        <header className="screen__bar">
          <span className="screen__title">new board</span>
          <span className="screen__board-name">get your disks</span>
        </header>
        <VendingMachine
          coins={themeText ? 2 : 3}
          theme={themeText}
          onBack={() => setStep('setup')}
          onDone={(sparks) => onCreate({ theme: themeText, name: name || undefined, sparks })}
        />
      </div>
    )
  }

  return (
    <div className="device__screen">
      <header className="screen__bar">
        <span className="screen__title">new board</span>
      </header>
      <form
        className="start"
        onSubmit={(e) => {
          e.preventDefault()
          if (themeMissing) return
          setStep('machines')
        }}
      >
        <p className="start__intro">
          You get three random floppy disks, each holding a starting thought. Connect them, push them, and see where they take you.
        </p>

        <fieldset className="start__modes">
          <legend>start with</legend>
          <label className={`start__mode${mode === 'blank' ? ' start__mode--on' : ''}`}>
            <input type="radio" name="mode" value="blank" checked={mode === 'blank'} onChange={() => setMode('blank')} />
            <strong>3 random disks</strong>
            <span>no idea yet? start here</span>
          </label>
          <label className={`start__mode${mode === 'theme' ? ' start__mode--on' : ''}`}>
            <input type="radio" name="mode" value="theme" checked={mode === 'theme'} onChange={() => setMode('theme')} />
            <strong>a theme + 2 disks</strong>
            <span>e.g. a hackathon theme like &quot;Time&quot;</span>
          </label>
        </fieldset>

        {mode === 'theme' && (
          <label className="start__field">
            theme
            <input
              autoFocus
              value={theme}
              maxLength={MAX_THEME}
              placeholder="Time"
              onChange={(e) => setTheme(e.target.value)}
            />
          </label>
        )}

        <label className="start__field">
          <span>
            board name <span className="start__optional">(optional)</span>
          </span>
          <input value={name} maxLength={80} placeholder={mode === 'theme' && theme ? theme : 'board name'} onChange={(e) => setName(e.target.value)} />
        </label>

        <div className="start__actions">
          <button type="submit" className="start__deal" disabled={themeMissing}>
            get my disks →
          </button>
          {onCancel && (
            <button type="button" className="start__cancel" onClick={onCancel}>
              back to my board
            </button>
          )}
        </div>
        <p className="start__note">3 swaps per board · 20 spaces · saved in this browser</p>
      </form>
    </div>
  )
}
