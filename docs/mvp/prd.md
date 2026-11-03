# Product requirements

## Goal
Help people come up with their own unique, fun coding project ideas (especially at hackathons) by giving them somewhere calm to think, random starting points when they want them, and gentle nudges, without ever handing them an idea.

## Non-goals
- Generating ideas for people (no LLM).
- Judging or scoring ideas.
- Telling people which tools or tech to use.

## Users
- **Hackathon teams and solo hackers** who need an idea, often with a theme (e.g. "Time").
- **Anyone with an itch to build something** but no clear idea yet.

## User stories
- As a hacker with a theme, I can set it as my board's main theme and brainstorm around it.
- As someone with no idea yet, I can start with a blank board and get random notes from the vending machine.
- As someone in flow, I can type thoughts without thinking about commands, and link them quickly.
- As someone stuck, I can ask for a nudge on any thought.
- As someone with a messy board, I can tidy it in one click and undo if I don't like it.
- As someone who's found an idea, I can mark it and get a summary of how I got there to share with my team.
- As someone who liked certain thoughts, I can favourite them and copy them onto a board of their own.

## Functional requirements
- Boards: create, rename, delete, switch; saved automatically in the browser.
- Thoughts: add by typing or double-clicking, edit your own, delete anything, link and unlink.
- Vending machine: one row per category, unlimited, never repeats a note already on the board.
- Nudges: words and questions that fit what's selected; works offline with question fallbacks.
- Terminal: commands start with `/`; Tab completion by name, number or words; grouped help.
- Tidy, fit to screen, undo/redo.
- Favourites, a favourites board, and a copyable summary of each favourite idea.

## Non-functional requirements
- **Accessibility:** keyboard-only use, visible focus, readable fonts, WCAG AA contrast, reduced-motion support.
- **Performance:** each edit is one storage write; layout and animation stay smooth on large boards.
- **Security and privacy:** no accounts or tracking; saved data is validated on load; only a single keyword ever leaves the device (for word nudges).
- **Cost:** £0 to run on free hosting.
- **Devices:** laptop and tablet first; phone layout later.

## Success measures
- People leave a session with an idea they want to build, and can explain how they got there.
- Boards show thoughts several links away from their starting notes, rather than only first ideas.

## Open questions
- How sharing and live collaboration should handle permissions and editing at the same time.
- Whether to add live content (like headlines) as notes, and how to keep it kind and safe.
