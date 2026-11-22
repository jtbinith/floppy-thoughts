# Word data for nudges

These files (`a.json` to `z.json`) are made by `scripts/build-words.py` from:

- **ConceptNet 5.7** by the Commonsense Computing Initiative, licensed under
  [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).
  ConceptNet includes data from WordNet, Wiktionary, Open Mind Common Sense and other sources;
  see https://github.com/commonsense/conceptnet5/wiki/Copying-and-sharing-ConceptNet.
- **wordfreq** by Robyn Speer, word frequency data licensed under
  [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).
- **List of Dirty, Naughty, Obscene, and Otherwise Bad Words** (used only to leave words out),
  licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).

Built from ConceptNet 5.7.0 (`conceptnet-assertions-5.7.0.csv.gz`) and wordfreq 3.1.1.

Changes: only English words people commonly know were kept, with each word's strongest links
(associations, opposites, what it's like, what it's for, where it's found, its parts and what it is
a kind of); filler, offensive words and words for groups of people were removed.

The word files are shared under the same licence, **CC BY-SA 4.0**. The rest of Floppy Thoughts
keeps its own licence.
