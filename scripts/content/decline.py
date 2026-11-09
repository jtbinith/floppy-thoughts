#!/usr/bin/env python3
"""Declines the notes struck out (~~like this~~) or deleted in a review file.

Usage: python3 scripts/content/decline.py REVIEW.md

The review file's original list sits beside it as REVIEW.items.json. Anything from that list that is
now struck or missing is taken out of src/content/notes/*.json (and the nudge questions), and added
to src/content/notes/declined.json so a later dataset pull never brings it back.
"""
import json, re, sys, datetime, pathlib

ROOT = pathlib.Path(__file__).resolve().parents[2]
NOTES = ROOT / 'src/content/notes'
QUESTIONS = ROOT / 'src/lib/nudges/questions.ts'

def main(review: pathlib.Path) -> None:
    original = json.loads(review.with_suffix('.items.json').read_text())
    kept, struck = set(), set()
    for line in review.read_text().splitlines():
        m = re.match(r'^\s*-\s+(.*?)\s*$', line)
        if not m:
            continue
        text = m.group(1)
        s = re.fullmatch(r'~~(.*)~~', text)
        (struck if s else kept).add((s.group(1) if s else text).strip())
    out = [t for t in original if t in struck or t not in kept]
    if not out:
        print('nothing declined')
        return
    declined_path = NOTES / 'declined.json'
    declined = json.loads(declined_path.read_text())
    today = datetime.date.today().isoformat()
    gone = set(out)
    for f in sorted(NOTES.glob('*.json')):
        if f.name == 'declined.json':
            continue
        notes = json.loads(f.read_text())
        left = [n for n in notes if n['text'] not in gone]
        for n in notes:
            if n['text'] in gone:
                declined.append({'text': n['text'], 'row': f.stem, 'declined': today})
        if len(left) != len(notes):
            f.write_text('[\n' + ',\n'.join('  ' + json.dumps(n, ensure_ascii=False) for n in left) + '\n]\n')
            print(f'{f.stem}: removed {len(notes) - len(left)}')
    # Nudge questions live in code: drop matching lines.
    q = QUESTIONS.read_text()
    for t in gone:
        lit = "'" + t.replace('\\', '\\\\').replace("'", "\\'") + "'"
        for form in (lit, json.dumps(t)):
            if form in q:
                q = re.sub(r'^[ \t]*' + re.escape(form) + r',[ \t]*\n', '', q, flags=re.M)
                declined.append({'text': t, 'row': 'nudges', 'declined': today})
                print(f'nudges: removed {t}')
    QUESTIONS.write_text(q)
    declined_path.write_text('[\n' + ',\n'.join('  ' + json.dumps(d, ensure_ascii=False) for d in declined) + '\n]\n' if declined else '[]\n')
    print(f'declined {len(out)}')

if __name__ == '__main__':
    main(pathlib.Path(sys.argv[1]))
