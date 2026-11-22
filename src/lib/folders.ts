import { z } from 'zod'
import { MAX_BOARD_NAME } from './board'
import { cleanText } from './boardOps'

// Folders on the boards page: your own way of grouping boards (one per hackathon, class or
// project). Folders hold boards and other folders, as deep as you like. They're personal: on a
// shared board, everyone files it in their own folders (or none).

export type Folder = { id: string; name: string; parentId: string | null; createdAt: string }
// All your folders, and which folder each board is in (a board in no folder isn't listed).
export type Folders = { folders: Folder[]; placed: Record<string, string> }

export const NO_FOLDERS: Folders = { folders: [], placed: {} }
export const MAX_FOLDER_NAME = MAX_BOARD_NAME

export const foldersSchema = z.object({
  folders: z.array(
    z.object({ id: z.string().min(1), name: z.string().trim().min(1).max(MAX_FOLDER_NAME), parentId: z.string().nullable(), createdAt: z.string() }),
  ),
  placed: z.record(z.string(), z.string()),
})

export const cleanFolderName = (name: string) => cleanText(name).slice(0, MAX_FOLDER_NAME)

export const folderById = (f: Folders, id: string | null) => (id ? f.folders.find((x) => x.id === id) : undefined)

// The folders directly inside one (or at the top, for null), by name.
export const foldersIn = (f: Folders, parentId: string | null) =>
  f.folders.filter((x) => x.parentId === parentId).sort((a, b) => a.name.localeCompare(b.name, 'en', { numeric: true, sensitivity: 'base' }))

// Where a board is: its folder's id, or null at the top.
export const folderOf = (f: Folders, boardId: string): string | null => {
  const id = f.placed[boardId]
  return id && folderById(f, id) ? id : null
}

// The way down to a folder from the top: [Hackathons, OxHack, Day 1].
export function pathTo(f: Folders, id: string | null): Folder[] {
  const path: Folder[] = []
  const seen = new Set<string>()
  for (let at = folderById(f, id); at && !seen.has(at.id); at = folderById(f, at.parentId)) {
    seen.add(at.id)
    path.unshift(at)
  }
  return path
}

// A folder and every folder inside it, however deep.
export function withEverythingInside(f: Folders, id: string): Set<string> {
  const all = new Set([id])
  for (let grew = true; grew; ) {
    grew = false
    for (const x of f.folders)
      if (x.parentId && all.has(x.parentId) && !all.has(x.id)) {
        all.add(x.id)
        grew = true
      }
  }
  return all
}

// Boards in a folder or any folder inside it.
export const boardsInside = (f: Folders, id: string): string[] => {
  const inside = withEverythingInside(f, id)
  return Object.entries(f.placed)
    .filter(([, folder]) => inside.has(folder))
    .map(([board]) => board)
}

// Whether a folder can move into another (or to the top): never into itself or anything inside it.
export const canMoveFolder = (f: Folders, id: string, into: string | null) => into === null || (!withEverythingInside(f, id).has(into) && !!folderById(f, into))

// The changes, as new copies. Each returns null if it can't be done.

export function makeFolder(f: Folders, name: string, parentId: string | null, id: string, now: Date): Folders | null {
  const clean = cleanFolderName(name)
  if (!clean || (parentId && !folderById(f, parentId))) return null
  return { ...f, folders: [...f.folders, { id, name: clean, parentId, createdAt: now.toISOString() }] }
}

export function renameFolder(f: Folders, id: string, name: string): Folders | null {
  const clean = cleanFolderName(name)
  if (!clean || !folderById(f, id)) return null
  return { ...f, folders: f.folders.map((x) => (x.id === id ? { ...x, name: clean } : x)) }
}

export function moveFolder(f: Folders, id: string, into: string | null): Folders | null {
  if (!folderById(f, id) || !canMoveFolder(f, id, into)) return null
  return { ...f, folders: f.folders.map((x) => (x.id === id ? { ...x, parentId: into } : x)) }
}

export function placeBoard(f: Folders, boardId: string, into: string | null): Folders | null {
  if (into && !folderById(f, into)) return null
  const placed = { ...f.placed }
  if (into) placed[boardId] = into
  else delete placed[boardId]
  return { ...f, placed }
}

// Deleting a folder. Keeping what's inside moves its boards and folders up to where the folder
// was; otherwise every folder inside goes too, and `boards` are the boards to delete with it.
export function deleteFolder(f: Folders, id: string, keepInside: boolean): { folders: Folders; boards: string[] } | null {
  const folder = folderById(f, id)
  if (!folder) return null
  if (keepInside) {
    const placed = Object.fromEntries(
      Object.entries(f.placed).flatMap(([board, at]) => (at !== id ? [[board, at]] : folder.parentId ? [[board, folder.parentId]] : [])),
    )
    const folders = f.folders.filter((x) => x.id !== id).map((x) => (x.parentId === id ? { ...x, parentId: folder.parentId } : x))
    return { folders: { folders, placed }, boards: [] }
  }
  const gone = withEverythingInside(f, id)
  const boards = boardsInside(f, id)
  const placed = Object.fromEntries(Object.entries(f.placed).filter(([, at]) => !gone.has(at)))
  return { folders: { folders: f.folders.filter((x) => !gone.has(x.id)), placed }, boards }
}

// Leaves out boards that aren't in the list any more (deleted, or you left them).
export const forgetBoards = (f: Folders, keep: (boardId: string) => boolean): Folders => ({
  ...f,
  placed: Object.fromEntries(Object.entries(f.placed).filter(([board]) => keep(board))),
})
