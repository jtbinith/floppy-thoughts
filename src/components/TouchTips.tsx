import { HeartIcon } from './HeartIcon'
import { ShrimpIcon } from './ShrimpIcon'

// The help tab on a touch screen (phone or tablet): how to do everything by touch, in place of the terminal commands and
// keyboard shortcuts (which need a keyboard). The terminal is still there behind >_ for anyone
// who'd rather type.

const TIPS: { title: string; how: React.ReactNode }[] = [
  { title: 'Add an idea', how: <>Tap +, type it, then tap anywhere on the board (or return) to put it down.</> },
  { title: 'Do things with a box', how: <>Tap it: a bar along the bottom of the board has ♥, nudge, edit, link, + next and the bin.</> },
  { title: 'Change an idea', how: <>Tap the box, then edit (or double-tap it).</> },
  { title: 'Link two ideas', how: <>Tap a box, then link, then the box to link it to. Or drag from the dot on a box&apos;s edge onto another box.</> },
  { title: 'Follow a thought', how: <>Tap a box, then + next: a new idea, already linked to it.</> },
  {
    title: 'Get a note',
    how: (
      <>
        Tap <ShrimpIcon size={16} /> to open the machine, then tap a row letter on its keypad (or a slot like B then 2) and OK. Or tap ? for a surprise.
      </>
    ),
  },
  { title: 'Stuck?', how: <>Tap a box, then nudge, for a word or a question to push the idea further.</> },
  {
    title: 'Favourite',
    how: (
      <>
        Tap a box, then <HeartIcon size={12} />, on the ideas you&apos;d build. They&apos;re all in the favourites tab.
      </>
    ),
  },
  { title: 'Move around', how: <>Drag the board to look around and pinch to zoom. Tidy the board is in the Menu.</> },
  { title: 'Delete', how: <>Tap a box, then the bin. Changed your mind? Undo (↶) is at the top.</> },
  { title: 'Rather type?', how: <>Use the terminal (behind &gt;_ on a phone): type a thought and press return, or a command starting with /.</> },
]

export function TouchTips() {
  return (
    <div className="commands touch-tips">
      <ul className="touch-tips__list">
        {TIPS.map((t) => (
          <li key={t.title}>
            <strong>{t.title}</strong>
            <span>{t.how}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
