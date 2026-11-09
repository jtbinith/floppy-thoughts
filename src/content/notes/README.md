# Vending machine notes

One file per row of the machine. Each note is one line:

```json
{"text": "Brass sundial, 1700s", "origin": "met"}
{"text": "Saturn is less dense than water", "origin": "hand", "source": "https://en.wikipedia.org/wiki/Saturn#Physical_characteristics"}
```

- `origin`: `hand` (written by hand) or the open dataset it was picked from: `met` ([The Met Open Access](https://github.com/metmuseum/openaccess), CC0), `wordnet` or `wikidata` (CC0). Dataset notes are reworded, never copied whole.
- `source`: a link that backs up a fact. Every curiosity needs one, and so does any real place in `nature`.

## Rules

- Concrete and easy to picture. Kind. True. Never a finished idea.
- Variety: different countries, eras, ages and abilities.
- No brand names, UK spelling, no full stop at the end, no comma before "and" or "or", 80 characters at most.
- Problems are a quote in the first person: `"I never know which day the bins go out"`.
- From datasets, leave out weapons, armour, human remains, religious and burial objects, ritual masks and ivory.

`npm test` checks the parts that can be checked.

## Declined

`declined.json` lists notes that were turned down, so a later dataset pull never brings them back. To decline notes from a review file, strike them (`~~like this~~`) or delete the line, then run:

```bash
python3 scripts/content/decline.py path/to/review.md
```
