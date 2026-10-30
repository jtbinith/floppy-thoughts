// The home page: what Floppy Thoughts is, how it works, and example boards.
// Screenshots and the intro video are placeholders until the app's look settles.

type Props = {
  hasBoards: boolean
}

type Example = { title: string; sparks: string[]; chain: string[]; idea: string }

// Illustrative boards showing shrimp notes turning into an idea worth building.
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
          <a className="home__link" href="#/boards">
            my boards →
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
              A brainstorming board for your own thoughts, with a vending machine full of shrimp when you want a push. Each
              one cracks open like a fortune cookie to hand you a random starting thought, and the board helps you push them into an idea you&apos;d actually want to build.
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
          <Placeholder label="video coming soon" alt="A short video showing a board going from a few shrimp notes to an idea" tall />
        </section>

        <section className="home__section">
          <h2>why</h2>
          <p>
            Every project starts with the same question: <em>what should I build?</em> Whether it&apos;s a hackathon, a
            weekend, or just an itch to make something, your head tends to serve up the same few ideas everyone else has.
          </p>
          <p>
            Floppy Thoughts gives your brain something to push against: random notes from the vending machine, a nudge
            when you&apos;re stuck, and a board for following one thought somewhere unexpected. The idea is still yours. Floppy Thoughts just gets it moving.
          </p>
        </section>

        <section className="home__section">
          <h2>how it works</h2>
          <ol className="home__steps">
            <li>
              <Placeholder label="screenshot" alt="The vending machine beside a new board, a shrimp handing over a note" />
              <strong>1. get some shrimp notes</strong>
              <span>A word, an object, a problem, a curious fact. Take as many or as few as you like, or bring your own theme.</span>
            </li>
            <li>
              <Placeholder label="screenshot" alt="Ideas linked between notes, with a nudge beside one of them" />
              <strong>2. connect and push them</strong>
              <span>Add your own ideas, link them, and press N for a nudge when you&apos;re stuck.</span>
            </li>
            <li>
              <Placeholder label="screenshot" alt="A board with one idea developed several steps from the notes, marked as a favourite" />
              <strong>3. land on an idea</strong>
              <span>Heart the thoughts you like. Your favourites from every board are kept in one place.</span>
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
