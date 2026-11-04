// Everything Floppy Thoughts keeps in this browser, under one prefix, in one place.
const PREFIX = 'floppy:'

export const KEYS = {
  boardPrefix: `${PREFIX}board:`,
  board: (id: string) => `${PREFIX}board:${id}`,
  lastBoard: `${PREFIX}ui:last-board`,
  terminalHeight: `${PREFIX}ui:terminal-height`,
  panel: `${PREFIX}ui:panel`,
  panelWidth: `${PREFIX}ui:panel-width`,
  seenNotes: `${PREFIX}seen-sparks`,
  theme: `${PREFIX}ui:theme`,
  boardSort: `${PREFIX}ui:board-sort`,
  // A note picked on the home page, to start the next new board with (session only).
  startNote: `${PREFIX}ui:start-note`,
  // The page you were on when you clicked "sign in", to come back to (session only).
  returnTo: `${PREFIX}ui:return-to`,
  // When this browser's boards were moved to an account (once per account).
  uploaded: (accountId: string) => `${PREFIX}account:uploaded:${accountId}`,
  // Signed in: a copy of each of your account's boards, and changes not sent yet, so boards open
  // and keep saving without a connection. All of it goes when you sign out.
  account: (accountId: string) => `${PREFIX}account:${accountId}:`,
  accountBoard: (accountId: string, boardId: string) => `${PREFIX}account:${accountId}:board:${boardId}`,
  outbox: (accountId: string) => `${PREFIX}account:${accountId}:outbox`,
}

// The site used to be called HunchHack, and its keys started "hunchhack:". This moves them
// over once, so nobody loses a board. Keys already moved are left alone.
const OLD_PREFIX = 'hunchhack:'

export function moveOldKeys(storage: Storage = localStorage): number {
  const old: string[] = []
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i)
    if (key?.startsWith(OLD_PREFIX)) old.push(key)
  }
  for (const key of old) {
    const moved = PREFIX + key.slice(OLD_PREFIX.length)
    const value = storage.getItem(key)
    if (value !== null && storage.getItem(moved) === null) storage.setItem(moved, value)
    storage.removeItem(key)
  }
  return old.length
}
