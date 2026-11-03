import { Dialog } from './Dialog'

// The board's keyboard shortcuts, vim-style, on one card. Press ? on the board to open it.
// These work while the board has focus (click it, or press Esc in the terminal).

const BOARD_KEYS: { group: string; keys: [string, string][] }[] = [
  {
    group: 'move around',
    keys: [
      ['h j k l  or  arrows', 'select the next box left, down, up, right'],
      ['g g', 'jump to the first theme'],
      ['z z', 'centre on the selected box'],
      ['Esc', 'deselect (or stop linking)'],
    ],
  },
  {
    group: 'change things',
    keys: [
      ['i  or  Enter', 'edit the selected idea or theme'],
      ['o  or  Tab', 'new idea linked to the selected box'],
      ['a', 'new idea in the middle of the view'],
      ['x  or  Delete', 'delete what is selected'],
      ['c … c', 'link: c on one box, move to another, c again'],
      ['Shift + h j k l', 'move the selected box'],
      ['u', 'undo'],
      ['Ctrl+r', 'redo'],
    ],
  },
  {
    group: 'notes and ideas',
    keys: [
      ['f', 'favourite (or unfavourite)'],
      ['n', 'nudge: a word or question to push it further'],
      ['v', 'the vending machine'],
    ],
  },
  {
    group: 'elsewhere',
    keys: [
      ['/  or  :', 'jump to the terminal'],
      ['?', 'these shortcuts'],
    ],
  },
]

export function KeysSheet({ onClose }: { onClose: () => void }) {
  return (
    <Dialog label="Keyboard shortcuts" onCancel={onClose} wide>
      <h2 className="dialog__title">Keyboard shortcuts</h2>
      <p className="dialog__text">On the board (click it, or Esc from the terminal). Like vim.</p>
      <div className="keys">
        {BOARD_KEYS.map((g) => (
          <section key={g.group}>
            <h3>{g.group}</h3>
            <dl>
              {g.keys.map(([k, does]) => (
                <div key={k}>
                  <dt>
                    {k.split('  or  ').map((part, i) => (
                      <span key={part}>
                        {i > 0 && <small> or </small>}
                        {part.split(/\s+/).map((key, j) => (key === '…' || key === '+' ? <small key={j}> {key} </small> : <kbd key={j}>{key}</kbd>))}
                      </span>
                    ))}
                  </dt>
                  <dd>{does}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
      <div className="popup__actions">
        <button type="button" className="popup__back" onClick={onClose} autoFocus>
          close
        </button>
      </div>
    </Dialog>
  )
}
