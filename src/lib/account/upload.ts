import { KEYS } from '../keys'
import type { StorageAdapter } from '../storage'
import type { FolderStore, LocalFolders } from '../folderStore'
import { forUpload } from './rows'

// The first time you sign in on this browser, the boards you made here move to your account,
// so nothing made before is lost. Each one leaves the browser only once it's safely uploaded.
// Returns how many moved. Asked twice at once (React does that in development), it moves them once.
const moving = new Map<string, Promise<number>>()
export function moveBrowserBoards(browser: StorageAdapter, account: StorageAdapter, accountId: string, folders?: { from: LocalFolders; to: FolderStore }): Promise<number> {
  const running = moving.get(accountId) ?? move(browser, account, accountId, folders).finally(() => moving.delete(accountId))
  moving.set(accountId, running)
  return running
}

async function move(browser: StorageAdapter, account: StorageAdapter, accountId: string, folders?: { from: LocalFolders; to: FolderStore }): Promise<number> {
  const done = KEYS.uploaded(accountId)
  if (localStorage.getItem(done)) return 0
  let moved = 0
  // Uploaded boards get new ids, so the folders they were in follow them by their new ids.
  const local = folders ? await folders.from.load() : null
  for (const summary of await browser.listBoards()) {
    const result = await browser.loadBoard(summary.id)
    if (result.status !== 'ok') continue
    const copy = forUpload(result.board)
    await account.saveBoard(copy)
    await browser.deleteBoard(summary.id)
    // The board you had open stays the one you have open.
    if (localStorage.getItem(KEYS.lastBoard) === summary.id) localStorage.setItem(KEYS.lastBoard, copy.id)
    if (local && local.placed[summary.id]) {
      local.placed[copy.id] = local.placed[summary.id]
      delete local.placed[summary.id]
      // Kept in step as each board moves, so a sign-in cut short loses nothing.
      await folders!.from.save(local, local)
    }
    moved++
  }
  // Your folders come too, added to any your account already has.
  if (folders && local && (local.folders.length || Object.keys(local.placed).length)) {
    const there = await folders.to.load()
    // Only boards that made it to the account (a broken board stays in the browser, unfiled).
    const onAccount = new Set((await account.listBoards()).map((b) => b.id))
    for (const board of Object.keys(local.placed)) if (!onAccount.has(board)) delete local.placed[board]
    const have = new Set(there.folders.map((f) => f.id))
    const merged = { folders: [...there.folders, ...local.folders.filter((f) => !have.has(f.id))], placed: { ...there.placed, ...local.placed } }
    await folders.to.save(there, merged)
    folders.from.clear()
  }
  localStorage.setItem(done, new Date().toISOString())
  return moved
}
