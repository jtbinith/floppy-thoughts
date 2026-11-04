import { Dialog } from './Dialog'

// The board's keyboard shortcuts, on one card. Press ? on the board to open it. They're vim's
// keys, so each one has a reason for its letter, shown next to it: easy to remember, and the
// same keys work in vim itself if you ever try it.

type Key = { keys: string; does: string; why?: string }

const BOARD_KEYS: { group: string; keys: Key[] }[] = [
  {
    group: 'move around',
    keys: [
      { keys: 'h j k l  or  arrows', does: 'select the box left, down, up or right', why: 'four keys under your right hand, so it never leaves the keyboard' },
      { keys: 'g g', does: 'jump to the first theme', why: 'go to the top' },
      { keys: 'G', does: 'jump to the last box', why: 'go to the bottom' },
      { keys: 'z z', does: 'centre on the selected box', why: 'z is for the view' },
      { keys: 'z f', does: 'fit the whole board on screen', why: 'z for the view, f for fit' },
      { keys: 'Esc', does: 'deselect, or stop linking', why: 'back out of whatever you were doing' },
    ],
  },
  {
    group: 'change things',
    keys: [
      { keys: 'i  or  Enter', does: 'edit the selected idea or theme', why: 'insert: start typing' },
      { keys: 'o  or  Tab', does: 'new idea linked to the selected box', why: 'open a new line after this one' },
      { keys: 'a', does: 'new idea in the middle of the view', why: 'add' },
      { keys: 'x  or  d d  or  Delete', does: 'delete what is selected', why: 'x crosses it out; d d is delete' },
      { keys: 'y y  then  p', does: 'copy a box, then paste it as a new idea', why: 'yank (copy) and put' },
      { keys: 'c … c', does: 'link: c on one box, move to another, c again', why: 'connect' },
      { keys: 'Shift + h j k l', does: 'move the selected box', why: 'the same directions, held down' },
      { keys: '=', does: 'tidy the board', why: 'in vim, = lays things out neatly' },
      { keys: 'u', does: 'undo', why: 'undo' },
      { keys: 'Ctrl+r', does: 'redo', why: 'redo' },
    ],
  },
  {
    group: 'notes and ideas',
    keys: [
      { keys: 'f', does: 'favourite (or unfavourite)', why: 'favourite' },
      { keys: 'n', does: 'nudge: a word or question to push it further', why: 'nudge' },
      { keys: 'v', does: 'the vending machine', why: 'vend' },
    ],
  },
  {
    group: 'elsewhere',
    keys: [
      { keys: ':', does: 'type a command, like :tidy or :fav 3', why: 'in vim, : starts a command; / works too' },
      { keys: '?', does: 'these shortcuts', why: 'help' },
    ],
  },
]

export function KeysSheet({ onClose }: { onClose: () => void }) {
  return (
    <Dialog label="Keyboard shortcuts" onCancel={onClose} wide>
      <button type="button" className="popup__x" aria-label="Close" onClick={onClose} autoFocus>
        ×
      </button>
      <h2 className="dialog__title">Keyboard shortcuts</h2>
      <p className="dialog__text">
        Click the board (or press Esc in the terminal), then use these. They&apos;re the keys of vim, a text editor many coders use. New to vim? Each key has a
        reason, shown in grey, so it sticks. Learn a few here and they work in vim too.
      </p>
      <div className="keys">
        {BOARD_KEYS.map((g) => (
          <section key={g.group}>
            <h3>{g.group}</h3>
            <dl>
              {g.keys.map((k) => (
                <div key={k.keys}>
                  <dt>
                    {k.keys.split('  or  ').map((part, i) => (
                      <span key={part}>
                        {i > 0 && <small> or </small>}
                        {part.split(/\s+/).map((key, j) =>
                          key === '…' || key === '+' || key === 'then' ? (
                            <small key={j}> {key} </small>
                          ) : (
                            <kbd key={j}>{key}</kbd>
                          ),
                        )}
                      </span>
                    ))}
                  </dt>
                  <dd>
                    {k.does}
                    {k.why && <small className="keys__why">{k.why}</small>}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
      <p className="dialog__text keys__more">
        Anything without a key is a command: press <kbd>:</kbd> and type it, like <code>:theme Time</code>, <code>:unlink 3</code> or{' '}
        <code>:summary</code>. Tab finishes them. The commands tab in the drawer lists them all.
      </p>
    </Dialog>
  )
}
