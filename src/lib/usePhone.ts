import { useSyncExternalStore } from 'react'

// Two questions about the screen, each kept up to date as the window is resized or the device is
// turned (the same tests as styles/phone.css):
//
// - usePhone: a small screen, where the board switches to its stacked layout (bottom button bar,
//   things opening below the board). A phone upright is narrow; a phone turned sideways is wide but
//   short, so short touch screens count too. Tablets don't: they keep the roomy layout.
// - useTouch: a touch screen (phones and tablets, any way up), with fingers and no keyboard: a tapped
//   box gets a bar of buttons, there are undo and redo buttons, and help is about tapping.
export const PHONE_QUERY = '(max-width: 700px), (pointer: coarse) and (max-height: 500px)'
export const TOUCH_QUERY = '(pointer: coarse)'

const matches = (query: string) => window.matchMedia?.(query).matches ?? false

function useMedia(query: string) {
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia?.(query)
      list?.addEventListener('change', onChange)
      return () => list?.removeEventListener('change', onChange)
    },
    () => matches(query),
    () => false,
  )
}

export const usePhone = () => useMedia(PHONE_QUERY)
export const useTouch = () => useMedia(TOUCH_QUERY)
