# Floppy Thoughts

> Ideas worth hacking on.

A calm, playful brainstorming board for coming up with your own fun, unique coding project ideas. Type your thoughts and link them, get random starting notes from a vending machine full of shrimp (each one cracks open like a fortune cookie), and ask for a nudge when you're stuck: a word or a question, never an answer. The thinking stays yours.

## What you can do

- **Brainstorm on a board:** type a thought and press Enter, link thoughts by dragging or with `/link`, and set a main theme like "Time".
- **Get starting notes** from the vending machine: words, objects, problems, curiosities and nature.
- **Ask for nudges** that fit what you've selected, such as a related word, a change of perspective or scale, or a push.
- **Tidy** a messy board in one click: groups of linked thoughts get their own space, with as few crossing lines as possible.
- **Favourite** the thoughts you like and copy them onto a board of their own.
- **Mark the one** you're going with, and copy a summary of how you got there.
- **Work from the keyboard:** commands start with `/`, Tab completes them (and finds thoughts by their words), and `/help` opens the full list.

Boards are saved in your browser. There are no accounts and no tracking.

## Run it

```bash
npm install
npm run dev
```

| Script | What it does |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` | Type-check and build for production |
| `npm test` | Unit tests (Vitest) |
| `npm run test:e2e` | Browser tests (Playwright, Chromium) |
| `npm run lint` | Lint (oxlint) |

## Built with

React, TypeScript and Vite. Board logic is pure functions over immutable data; commands come from a single registry (see the [architecture](docs/mvp/architecture.md)).

## Docs

- [Vision](docs/vision.md): the problem and the principles
- [Product requirements](docs/mvp/prd.md)
- [Architecture](docs/mvp/architecture.md): how it works
- [Brand](docs/brand.md): story, voice, colours and type

## Credits

- [React Flow](https://reactflow.dev) (MIT) draws the board: boxes, links, panning and zooming. Thank you to the xyflow team. React Flow's attribution link is shown on the board, as they ask for projects without a Pro subscription.
- [d3-force](https://d3js.org/d3-force) (ISC) lays the board out when you tidy it.
- [Zod](https://zod.dev) (MIT) checks saved boards.
- [Datamuse](https://www.datamuse.com/api/) provides words for word nudges.
- Fonts: [Atkinson Hyperlegible](https://www.brailleinstitute.org/freefont/) and [Bricolage Grotesque](https://fonts.google.com/specimen/Bricolage+Grotesque) (both OFL).

## Licence

[MIT](LICENSE)
