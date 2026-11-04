import { isFavourite, type Board } from '../../lib/board'
import { favouriteIdeas } from '../../lib/summary'
import type { BoardSummary } from '../../lib/storage'
import type { Menu, MenuItem } from '../MenuBar'
import type { PanelTab } from '../SidePanel'

// The menus along the top of the board's screen: Board, Edit, View and Help. The shortcuts shown
// are the board's keys (see KeysSheet).
export function workspaceMenus(d: {
  board: Board
  boards: BoardSummary[]
  // Which drawer tab is open, if any.
  panel: PanelTab | null
  newBoard: () => void
  rename: () => void
  share: () => void
  // Your role on a shared board (null on a board only you have).
  role: string | null
  openBoard: (id: string) => void
  favouritesBoard: () => void
  showIdea: () => void
  deleteBoard: () => void
  undo: () => void
  redo: () => void
  addIdea: () => void
  addTheme: () => void
  nudge: () => void
  deleteSelected: () => void
  tidy: () => void
  openMachine: () => void
  openPanel: (tab: PanelTab | null) => void
  focusTerminal: () => void
  fit: () => void
  showKeys: () => void
}): Menu[] {
  const { board } = d
  const hasFavourites = board.nodes.some(isFavourite)
  const recentBoards = d.boards.filter((b) => b.id !== board.id).slice(0, 5)
  return [
    {
      label: 'Board',
      items: [
        { label: 'New board', onSelect: d.newBoard },
        { label: 'Rename…', onSelect: d.rename },
        { label: 'Share…', onSelect: d.share },
        'divider',
        // Recent boards, one click to switch (like VS Code's Open Recent).
        ...recentBoards.map((b): MenuItem => ({ label: b.name, onSelect: () => d.openBoard(b.id) })),
        { label: 'All boards…', onSelect: () => (location.hash = '/boards') },
        'divider',
        { label: 'Favourite on a new board', onSelect: d.favouritesBoard, disabled: !hasFavourites },
        { label: 'My favourite ideas', onSelect: d.showIdea, disabled: !favouriteIdeas(board).length },
        'divider',
        { label: d.role && d.role !== 'owner' ? 'Leave this board…' : 'Delete this board…', onSelect: d.deleteBoard },
      ],
    },
    {
      label: 'Edit',
      items: [
        { label: 'Undo', shortcut: 'u / Ctrl+Z', onSelect: d.undo },
        { label: 'Redo', shortcut: 'Ctrl+R / Ctrl+Shift+Z', onSelect: d.redo },
        'divider',
        { label: 'Add an idea', shortcut: 'a / double-click', onSelect: d.addIdea },
        { label: 'Add a theme…', onSelect: d.addTheme },
        { label: 'Nudge the selected idea', shortcut: 'n', onSelect: d.nudge },
        { label: 'Delete selected', shortcut: 'x / Delete', onSelect: d.deleteSelected },
        'divider',
        { label: 'Tidy the board', onSelect: d.tidy, disabled: board.nodes.length < 2 },
      ],
    },
    {
      label: 'View',
      items: [
        { label: 'Vending machine', shortcut: 'v', onSelect: d.openMachine },
        { label: 'Favourites', onSelect: () => d.openPanel('favourites') },
        { label: 'Commands', onSelect: () => d.openPanel('commands') },
        { label: 'Close the drawer', shortcut: 'Esc', onSelect: () => d.openPanel(null), disabled: !d.panel },
        'divider',
        { label: 'Terminal', shortcut: 'Ctrl+`', onSelect: d.focusTerminal },
        { label: 'Fit the board to the screen', onSelect: d.fit },
      ],
    },
    {
      label: 'Help',
      items: [
        { label: 'Commands', onSelect: () => d.openPanel('commands') },
        { label: 'Keyboard shortcuts', shortcut: '?', onSelect: d.showKeys },
      ],
    },
  ]
}
