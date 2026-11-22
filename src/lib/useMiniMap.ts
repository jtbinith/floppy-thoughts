import { useState } from 'react'
import { KEYS } from './keys'
import { PHONE_QUERY } from './usePhone'

// Whether the board shows its mini-map. It starts on, except on a phone (a small screen, with the
// button bar along the bottom); after that it's whatever you last chose, in this browser.
export function useMiniMap(): [boolean, (on: boolean) => void] {
  const [on, setOn] = useState(() => {
    const saved = localStorage.getItem(KEYS.miniMap)
    if (saved === 'on' || saved === 'off') return saved === 'on'
    return !(window.matchMedia?.(PHONE_QUERY).matches ?? false)
  })
  const set = (next: boolean) => {
    setOn(next)
    localStorage.setItem(KEYS.miniMap, next ? 'on' : 'off')
  }
  return [on, set]
}
