import { useState } from 'react'
import { SORTS, findBoards, isSort, type Sort } from '../lib/findBoards'
import { KEYS } from '../lib/keys'
import type { BoardSummary } from '../lib/storage'
import { BoardList } from './BoardList'
import { NavBar } from './NavBar'
import { SiteFooter } from './InfoPages'

// All your boards on their own page, outside the device (like the home page).
type Props = {
  boards: BoardSummary[]
  openId?: string
  onOpen: (id: string) => void
  onRename: (id: string, name: string) => void
  onDelete: (id: string) => void
}

const savedSort = (): Sort => {
  const value = localStorage.getItem(KEYS.boardSort)
  return isSort(value) ? value : 'edited'
}

export function BoardsPage(props: Props) {
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<Sort>(savedSort)
  const shown = findBoards(props.boards, search, sort)

  function changeSort(value: string) {
    if (!isSort(value)) return
    setSort(value)
    localStorage.setItem(KEYS.boardSort, value)
  }

  return (
    <div className="home">
      <NavBar current="boards" showBoards />
      <main className="boards-page">
        <h1>my boards</h1>
        <div className="boards-tools">
          <input
            type="search"
            className="boards-tools__search"
            placeholder="search names and thoughts…"
            aria-label="Search boards"
            value={search}
            onChange={(e) => setSearch(e.currentTarget.value)}
            onKeyDown={(e) => e.key === 'Escape' && setSearch('')}
          />
          <label className="boards-tools__sort">
            sort by
            <select value={sort} onChange={(e) => changeSort(e.currentTarget.value)}>
              {Object.entries(SORTS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <BoardList {...props} boards={shown} />
        {search && shown.length === 0 && <p className="boards-tools__none">No boards match “{search.trim()}”.</p>}
      </main>
      <SiteFooter />
    </div>
  )
}
