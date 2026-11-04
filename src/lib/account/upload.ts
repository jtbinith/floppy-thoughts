import { KEYS } from '../keys'
import type { StorageAdapter } from '../storage'
import { forUpload } from './rows'

// The first time you sign in on this browser, the boards you made here move to your account,
// so nothing made before is lost. Each one leaves the browser only once it's safely uploaded.
// Returns how many moved. Asked twice at once (React does that in development), it moves them once.
const moving = new Map<string, Promise<number>>()
export function moveBrowserBoards(browser: StorageAdapter, account: StorageAdapter, accountId: string): Promise<number> {
  const running = moving.get(accountId) ?? move(browser, account, accountId).finally(() => moving.delete(accountId))
  moving.set(accountId, running)
  return running
}

async function move(browser: StorageAdapter, account: StorageAdapter, accountId: string): Promise<number> {
  const done = KEYS.uploaded(accountId)
  if (localStorage.getItem(done)) return 0
  let moved = 0
  for (const summary of await browser.listBoards()) {
    const result = await browser.loadBoard(summary.id)
    if (result.status !== 'ok') continue
    const copy = forUpload(result.board)
    await account.saveBoard(copy)
    await browser.deleteBoard(summary.id)
    // The board you had open stays the one you have open.
    if (localStorage.getItem(KEYS.lastBoard) === summary.id) localStorage.setItem(KEYS.lastBoard, copy.id)
    moved++
  }
  localStorage.setItem(done, new Date().toISOString())
  return moved
}
