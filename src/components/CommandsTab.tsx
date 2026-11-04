import { helpGroups } from '../lib/commands'

// Every terminal command, grouped like `help`. It stays open beside the board
// while you type, so the terminal's history isn't pushed away. Clicking a command puts it in
// the terminal, ready to finish off.

const GROUPS = helpGroups()

// What to put in the terminal for an entry: the command itself, up to its first argument.
const commandOf = (usage: string) => {
  const first = usage.split(', ')[0]
  const name = first.split(/\s+[<[]/)[0].trim()
  return first.includes('<') || first.includes('[') ? `${name} ` : name
}

export function CommandsTab({ onUse, onShowKeys }: { onUse: (command: string) => void; onShowKeys: () => void }) {
  return (
    <div className="commands">
      <p className="commands__intro">Type a thought and press Enter to add it. Commands start with / (or : like vim):</p>
      {/* The other way to work: keys on the board itself. */}
      <button type="button" className="commands__keys" onClick={onShowKeys}>
        <kbd>?</kbd>
        <span>
          <strong>Prefer keys?</strong> Move, edit, link and favourite straight on the board with vim-style keys.
        </span>
      </button>
      {GROUPS.map((g) => (
        <section key={g.heading} className="commands__group">
          <h3>{g.heading}</h3>
          <ul>
            {g.entries.map((e) =>
              e.usage ? (
                <li key={e.usage}>
                  <button type="button" className="commands__entry" title="Put this in the terminal" onClick={() => onUse(commandOf(e.usage))}>
                    <code>{e.usage}</code>
                    <span>{e.does}</span>
                  </button>
                </li>
              ) : (
                <li key={e.does} className="commands__tip">
                  {e.does}
                </li>
              ),
            )}
          </ul>
        </section>
      ))}
    </div>
  )
}
