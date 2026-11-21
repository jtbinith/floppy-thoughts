import { useSyncExternalStore } from 'react'

// True on a phone-sized screen, where the board switches to its touch-first layout (see
// styles/phone.css, which uses the same width). Updates as the window is resized or turned.
export const PHONE_QUERY = '(max-width: 700px)'

const subscribe = (onChange: () => void) => {
  const query = window.matchMedia?.(PHONE_QUERY)
  query?.addEventListener('change', onChange)
  return () => query?.removeEventListener('change', onChange)
}

const isPhone = () => window.matchMedia?.(PHONE_QUERY).matches ?? false

export function usePhone() {
  return useSyncExternalStore(subscribe, isPhone, () => false)
}
