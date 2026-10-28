import { useEffect, useState } from 'react'
import { ReactFlowProvider } from '@xyflow/react'
import { Workspace } from './components/Workspace'
import type { Board } from './lib/board'
import { createSampleBoard } from './lib/sampleBoard'
import { LocalStorageAdapter } from './lib/storage'

const storage = new LocalStorageAdapter()
// Shared so React StrictMode's double-run in development doesn't create two sample boards.
let opening: Promise<Board> | null = null

// Opens the most recently edited board, or creates a sample one on first visit.
async function openLatestBoard(): Promise<Board> {
  const [latest] = await storage.listBoards()
  if (latest) {
    const result = await storage.loadBoard(latest.id)
    if (result.status === 'ok') return result.board
  }
  const board = createSampleBoard()
  await storage.saveBoard(board)
  return board
}

export default function App() {
  const [board, setBoard] = useState<Board | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    opening ??= openLatestBoard()
    opening.then(
      (b) => !cancelled && setBoard(b),
      (e: unknown) => !cancelled && setError(String(e)),
    )
    return () => {
      cancelled = true
    }
  }, [])

  function handleChange(next: Board) {
    setBoard(next)
    storage.saveBoard(next).catch((e: unknown) => setError(String(e)))
  }

  return (
    <div className="app">
      <header className="app__bar">
        <span className="app__brand">HunchHack</span>
        <span className="app__board-name">{board?.name}</span>
      </header>
      <main className="app__board">
        {error && <p className="app__message" role="alert">{error}</p>}
        {!error && !board && <p className="app__message">Loading…</p>}
        {board && (
          <ReactFlowProvider key={board.id}>
            <Workspace board={board} onChange={handleChange} />
          </ReactFlowProvider>
        )}
      </main>
    </div>
  )
}
