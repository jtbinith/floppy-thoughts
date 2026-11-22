import type { DragEvent } from 'react'

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
