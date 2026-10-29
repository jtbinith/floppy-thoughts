// The home page: what Floppy Thoughts is, how it works, and example boards.
// Screenshots and the intro video are placeholders until the app's look settles.

type Props = {
  hasBoards: boolean
}

type Example = { title: string; sparks: string[]; chain: string[]; idea: string }

// Illustrative boards showing disks turning into an idea worth building.
const EXAMPLES: Example[] = [
  {
    title: 'time',
    sparks: ['Time (theme)', 'Pocket sundial', 'A spider web covered in dew'],
    chain: ['who cares about dew?', 'photographers', 'shadows tell the time'],
    idea: 'A morning-walk companion: a dew alarm, plus a game where you guess the time from your shadow',
  },
  {
    title: 'cassette',
    sparks: ['cassette', '"My houseplants die while I\'m away"', 'Fireflies flashing in sync'],
    chain: ['mixtapes for plants?', 'what if plants could ask for water?', 'a light that pulses when thirsty'],
    idea: 'A plant sensor that blinks like a firefly, faster the thirstier it gets',
  },
  {
    title: 'telegraph',
    sparks: ['Morse code telegraph key', '"I always forget to take my medication"', 'Octopuses have three hearts'],
    chain: ['a tap on the wrist', 'three reminders a day', 'no screen at all'],
    idea: 'A pill box that taps a tiny Morse reminder on your wrist, no phone needed',
  },
]

function Placeholder({ label, alt, tall = false }: { label: string; alt: string; tall?: boolean }) {
  return (
    <div className={`home__placeholder${tall ? ' home__placeholder--tall' : ''}`} role="img" aria-label={alt}>
      <span>{label}</span>
      <small>{alt}</small>
    </div>
  )
}

export function Home({ hasBoards }: Props) {
  return (
    <div className="home">
      <header className="home__nav">
        <span className="home__logo">Floppy Thoughts</span>
        {hasBoards && (
          <a className="home__link" href="#/board">
            open my boards →
          </a>
        )}
      </header>

      <main>
        <section className="home__hero">
          <div>
            <h1>
              ideas worth <span>hacking on</span>
            </h1>
            <p className="home__lede">
              A brainstorming board that hands you three random floppy disks, each with a starting thought, and helps you
              push them into an idea you&apos;d actually want to build.
            </p>
            <div className="home__ctas">
              <a className="home__cta" href="#/new">
                start a board
              </a>
              {hasBoards && (
                <a className="home__cta home__cta--quiet" href="#/board">
                  continue where I left off
                </a>
              )}
            </div>
          </div>
          <Placeholder label="video coming soon" alt="A short video showing a board going from three disks to an idea" tall />
        </section>

        <section className="home__section">
          <h2>why</h2>
          <p>
            Every project starts with the same question: <em>what should I build?</em> Whether it&apos;s a hackathon, a
            weekend, or just an itch to make something, your head tends to serve up the same few ideas everyone else has.
          </p>
          <p>
            Floppy Thoughts gives your brain something to push against. Three random disks, a nudge when you&apos;re stuck,
            and a board that makes you go deeper instead of wider. The idea is still yours. Floppy Thoughts just gets it moving.
          </p>
        </section>

        <section className="home__section">
          <h2>how it works</h2>
          <ol className="home__steps">
            <li>
              <Placeholder label="screenshot" alt="Three disks loaded onto a new board: a word, an object and a problem" />
              <strong>1. get three random disks</strong>
              <span>A word, an object, a problem, a curious fact. Swap up to three you don&apos;t like.</span>
            </li>
            <li>
              <Placeholder label="screenshot" alt="Ideas linked between disks, with a nudge beside one of them" />
              <strong>2. connect and push them</strong>
              <span>Add your own ideas, link them, and press N for a nudge when you&apos;re stuck.</span>
            </li>
            <li>
              <Placeholder label="screenshot" alt="A full board with one idea developed several steps from the disks" />
              <strong>3. land on an idea</strong>
              <span>Twenty spaces on a board, so you go deep on one idea instead of jotting down fifty.</span>
            </li>
          </ol>
        </section>

        <section className="home__section">
          <h2>example boards</h2>
          <div className="home__examples">
            {EXAMPLES.map((ex) => (
              <article key={ex.idea} className="home__example">
                <header>~/{ex.title}</header>
                <ul className="home__sparks">
                  {ex.sparks.map((s) => (
                    <li key={s}>&gt; {s}</li>
                  ))}
                </ul>
                <p className="home__chain">{ex.chain.join(' → ')}</p>
                <p className="home__idea">
                  <span>idea</span> {ex.idea}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section className="home__section home__section--end">
          <a className="home__cta" href="#/new">
            start a board
          </a>
        </section>
      </main>

      <footer className="home__footer">
        <span>Floppy Thoughts · ideas worth hacking on</span>
        <span>
          built with <a href="https://reactflow.dev">React Flow</a>, <a href="https://zod.dev">Zod</a> and{' '}
          <a href="https://www.datamuse.com/api/">Datamuse</a>
        </span>
        <span title="Seriously, how is your posture right now?">🦐 sit up straight</span>
      </footer>
    </div>
  )
}
