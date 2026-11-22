#!/usr/bin/env python3
"""Builds the word files nudges use (public/words/*.json, one per first two letters) from open datasets.

Run by us, not by visitors, whenever the word data should change:

    python3 -m venv .words-venv && .words-venv/bin/pip install wordfreq
    .words-venv/bin/python -I scripts/build-words.py \
        --conceptnet path/to/conceptnet-assertions-5.7.0.csv.gz \
        --blocklist path/to/LDNOOBW-en.txt \
        --cmudict path/to/cmudict.dict

Datasets (none are committed; download them yourself):
- ConceptNet 5.7 assertions (CC BY-SA 4.0): https://github.com/commonsense/conceptnet5/wiki/Downloads
  How words are linked: associations, opposites, what things are like, used for, found at and so on.
- CMU Pronouncing Dictionary (BSD-style licence): https://github.com/cmusphinx/cmudict
  How words sound, for rhymes ("rhymes with clock: sock") and words that start the same way.
- wordfreq (CC BY-SA 4.0 data, Apache 2.0 code): https://github.com/rspeer/wordfreq
  How common each word is, to keep words people know.
- List of Dirty, Naughty, Obscene, and Otherwise Bad Words (CC BY 4.0):
  https://github.com/LDNOOBW/List-of-Dirty-Naughty-Obscene-and-Otherwise-Bad-Words
  plus our own lists in scripts/words-blocklist.txt and scripts/words-groups.txt (words for groups of
  people: ConceptNet holds stereotypes about them). Nothing on any list gets nudges or comes out of one.

The output is CC BY-SA 4.0, like ConceptNet (see public/words/LICENSE.md).
The file is read compressed, a line at a time, so it never needs unpacking (about 10 GB unpacked).
"""

import argparse
import csv
import gzip
import json
import os
import re
import sys
from collections import defaultdict

from wordfreq import top_n_list, zipf_frequency

# ConceptNet relation -> our name for it, and which way it reads. "forward" means the edge
# start -> end gives words for the start ("clock UsedFor telling time": clock is used for
# telling time). Symmetric relations give words both ways.
RELATIONS = {
    "/r/RelatedTo": ("related", "both"),
    "/r/Antonym": ("opposite", "both"),
    "/r/HasProperty": ("described", "forward"),
    "/r/UsedFor": ("usedFor", "forward"),
    "/r/AtLocation": ("foundAt", "forward"),
    "/r/CapableOf": ("canDo", "forward"),
    "/r/HasA": ("parts", "forward"),
    # "wheel PartOf car" is a part of the car: the word goes to the end.
    "/r/PartOf": ("parts", "backward"),
    "/r/IsA": ("kindOf", "forward"),
    "/r/Causes": ("causes", "forward"),
    "/r/HasPrerequisite": ("needs", "forward"),
    "/r/SimilarTo": ("similar", "both"),
    "/r/HasSubevent": ("involves", "forward"),
    "/r/MotivatedByGoal": ("doneTo", "forward"),
    "/r/MadeOf": ("madeOf", "forward"),
}

KEEP_PER_RELATION = 8
# How common a word must be (Zipf scale: 3 is about once per million words, 4 ten times that).
KNOWN_ZIPF = 3.0
SOURCE_ZIPF = 3.4
MAX_PHRASE_WORDS = 2
WORD = re.compile(r"^[a-z]+$")
# Filler words: a link to "when you" or "the" says nothing, so anything containing one is dropped.
FILLER = set(
    "a an the and or but of for to in on at by with from up about into over after my your our their his her its "
    "i me we you they it this that these those is are was were be been am do does did have has had not no so if "
    "then than too very can could would should will just what who how why when where which while own get got "
    "thing things something someone people person many much more most some any all one two lot lots".split()
)


def term_of(uri):
    """'/c/en/alarm_clock/n/...' -> 'alarm clock', or None if it isn't English."""
    parts = uri.split("/")
    if len(parts) < 4 or parts[2] != "en":
        return None
    return parts[3].replace("_", " ").lower()


def load_blocklist(paths):
    words, phrases = set(), set()
    for path in paths:
        with open(path, encoding="utf-8") as f:
            for line in f:
                entry = line.split("#", 1)[0].strip().lower()
                if not entry:
                    continue
                (phrases if " " in entry else words).add(entry)
    return words, phrases


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--conceptnet", required=True)
    parser.add_argument("--blocklist", required=True)
    parser.add_argument("--cmudict", required=True)
    parser.add_argument("--out", default=os.path.join(os.path.dirname(__file__), "..", "public", "words"))
    args = parser.parse_args()

    here = os.path.dirname(os.path.abspath(__file__))
    blocked_words, blocked_phrases = load_blocklist(
        [args.blocklist, os.path.join(here, "words-blocklist.txt"), os.path.join(here, "words-groups.txt")]
    )

    def is_blocked(term):
        return term in blocked_phrases or term in blocked_words or any(w in blocked_words for w in term.split())

    # Words people know, from the most common 60,000 English words.
    known = {w for w in top_n_list("en", 60000) if WORD.match(w) and len(w) >= 3 and zipf_frequency(w, "en") >= KNOWN_ZIPF}
    zipf = {w: zipf_frequency(w, "en") for w in known}

    def usable(term):
        words = term.split()
        return 1 <= len(words) <= MAX_PHRASE_WORDS and all(w in known and w not in FILLER for w in words) and not is_blocked(term)

    def is_source(term):
        return " " not in term and term in known and zipf[term] >= SOURCE_ZIPF and not is_blocked(term)

    # source -> relation -> target -> best weight
    links = defaultdict(lambda: defaultdict(dict))
    seen = 0
    with gzip.open(args.conceptnet, "rt", encoding="utf-8", newline="") as f:
        for row in csv.reader(f, delimiter="\t"):
            seen += 1
            if seen % 5_000_000 == 0:
                print(f"  read {seen:,} links", file=sys.stderr)
            if len(row) < 5 or row[1] not in RELATIONS:
                continue
            start, end = term_of(row[2]), term_of(row[3])
            if not start or not end or start == end:
                continue
            name, direction = RELATIONS[row[1]]
            info = json.loads(row[4])
            # DBpedia's links are about titles and names ("lighthouse is a book": a book called
            # Lighthouse), not the thing itself.
            if info.get("dataset", "").startswith("/d/dbpedia"):
                continue
            weight = info.get("weight", 1.0)
            pairs = {"forward": [(start, end)], "backward": [(end, start)], "both": [(start, end), (end, start)]}[direction]
            for source, target in pairs:
                if is_source(source) and usable(target) and source not in target.split():
                    best = links[source][name]
                    best[target] = max(weight, best.get(target, 0))

    add_sound_games(links, args.cmudict, known, zipf, is_source, usable)

    def plural_of(a, b):
        return b in (a + "s", a + "es") or a in (b + "s", b + "es") or (a.endswith("y") and b == a[:-1] + "ies")

    out = defaultdict(dict)
    for source, relations in links.items():
        entry = {}
        for name, targets in relations.items():
            # Strongest first; among equals, the more common word.
            ranked = sorted(targets.items(), key=lambda t: (-t[1], -min(zipf.get(w, 0) for w in t[0].split())))
            words = [t for t, _ in ranked if not plural_of(source, t)][:KEEP_PER_RELATION]
            if words:
                entry[name] = words
        # Only words with enough links to make a few different nudges.
        if sum(len(v) for v in entry.values()) >= 3:
            out[source[:2]][source] = entry

    os.makedirs(args.out, exist_ok=True)
    total = 0
    # One file per first two letters ("cl.json"), so a nudge only fetches a few kilobytes.
    for old in os.listdir(args.out):
        if old.endswith(".json"):
            os.remove(os.path.join(args.out, old))
    for prefix in sorted(out):
        words = dict(sorted(out[prefix].items()))
        total += len(words)
        with open(os.path.join(args.out, f"{prefix}.json"), "w", encoding="utf-8") as f:
            json.dump(words, f, separators=(",", ":"), ensure_ascii=True)
            f.write("\n")
    print(f"{total:,} words from {seen:,} ConceptNet links, in {len(out)} files", file=sys.stderr)


# Sound games: rhymes, and words that start with the same sounds. Only common words, never the word
# itself or a word built on it ("clock" doesn't rhyme with "o'clock", nor start like "clockwork").
SOUND_ZIPF = 3.3


def bare(phone):
    return phone.rstrip("012")


def rhyme_key(phones):
    """From the last stressed vowel to the end: clock K L AA1 K -> 'AA K'."""
    stressed = [i for i, p in enumerate(phones) if p[-1] in "12"]
    vowels = [i for i, p in enumerate(phones) if p[-1] in "012"]
    at = stressed[-1] if stressed else (vowels[-1] if vowels else None)
    return None if at is None else " ".join(bare(p) for p in phones[at:])


def start_key(phones):
    """The first two sounds: clock K L AA1 K -> 'K L'."""
    return " ".join(bare(p) for p in phones[:2]) if len(phones) >= 3 else None


def add_sound_games(links, cmudict_path, known, zipf, is_source, usable):
    sounds = defaultdict(list)
    with open(cmudict_path, encoding="utf-8") as f:
        for line in f:
            parts = line.split("#", 1)[0].split()
            if len(parts) < 2:
                continue
            word = re.sub(r"\(\d+\)$", "", parts[0].lower())
            if word in known:
                sounds[word].append(parts[1:])
    rhymes, starts = defaultdict(set), defaultdict(set)
    for word, prons in sounds.items():
        if zipf[word] < SOUND_ZIPF or not usable(word):
            continue
        for phones in prons:
            if (k := rhyme_key(phones)) is not None:
                rhymes[k].add(word)
            if (k := start_key(phones)) is not None:
                starts[k].add(word)

    def related_form(a, b):
        # The same word in another form ("cooking", "cookies"): built on each other, or the same
        # first four letters.
        return a.startswith(b) or b.startswith(a) or a.endswith(b) or b.endswith(a) or a[:4] == b[:4]

    # How connected each word is in ConceptNet: concrete things ("canoe", "candy") have lots of links,
    # everyday grammar words ("cannot") have few, so the better-connected ones come first. Words with
    # hardly any links don't come up at all.
    connected = {w: sum(len(t) for t in rel.values()) for w, rel in links.items()}
    for word, prons in sounds.items():
        if not is_source(word):
            continue
        phones = prons[0]
        for name, key, groups in (("rhymes", rhyme_key(phones), rhymes), ("startsLike", start_key(phones), starts)):
            if key is None:
                continue
            for other in groups.get(key, ()):
                if other != word and not related_form(word, other) and connected.get(other, 0) >= 8:
                    links[word][name][other] = connected[other]


if __name__ == "__main__":
    main()
