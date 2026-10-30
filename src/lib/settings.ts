// Your settings, kept in this browser.
const KEY = 'hunchhack:settings'

export const MAX_STARTING_NOTES = 9

export type Settings = {
  // How many random notes a new board starts with. 0 (the default) means a blank board.
  startingNotes: number
}

export const DEFAULT_SETTINGS: Settings = { startingNotes: 0 }

const clampNotes = (n: unknown) =>
  typeof n === 'number' && Number.isInteger(n) ? Math.min(MAX_STARTING_NOTES, Math.max(0, n)) : DEFAULT_SETTINGS.startingNotes

export function loadSettings(storage: Storage = localStorage): Settings {
  try {
    const data = JSON.parse(storage.getItem(KEY) ?? '{}') as Partial<Settings> | null
    return { startingNotes: clampNotes(data?.startingNotes) }
  } catch {
    return DEFAULT_SETTINGS
  }
}

export function saveSettings(settings: Settings, storage: Storage = localStorage): Settings {
  const clean = { startingNotes: clampNotes(settings.startingNotes) }
  storage.setItem(KEY, JSON.stringify(clean))
  return clean
}
