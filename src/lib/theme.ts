import { KEYS } from './keys'

// Dark or light mode. Your choice is remembered; until you choose, it follows your computer's setting.

export type Theme = 'dark' | 'light'

const saved = (): Theme | null => {
  const value = localStorage.getItem(KEYS.theme)
  return value === 'dark' || value === 'light' ? value : null
}
const system = (): Theme => (window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark')

export const currentTheme = (): Theme => (document.documentElement.dataset.theme === 'light' ? 'light' : 'dark')

export function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme
}

// Called once at start-up, before the first paint.
export function initTheme() {
  applyTheme(saved() ?? system())
}

export function setTheme(theme: Theme) {
  localStorage.setItem(KEYS.theme, theme)
  applyTheme(theme)
}
