/* Prove every gate in applyStems is LIVE.

   applyStems edits the lecturer's own question text. That is the most dangerous write
   in the pipeline, so nothing here is taken on trust: each guard is deliberately broken
   in a copy of stems.json, apply-migration is run against it, and this asserts the
   build DIED with the right complaint. A guard that has silently stopped firing fails
   here rather than quietly restemming the wrong card.

   The last two passes both lost content to an overlay that looked like it worked
   (~97 explanations overwritten, then a key that changed the moment it was written),
   and in both cases the gate that would have caught it had never been tested.

   Run: node audit/stems-selftest.mjs
*/
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REAL = path.join(HERE, 'stems.json');
const BACKUP = fs.readFileSync(REAL, 'utf8');
const doc = JSON.parse(BACKUP);

/* Each case mutates a COPY of the real file and states the phrase the failure must
   contain. `mut` receives a deep clone of the parsed document. */
const CASES = [
  ['stale key (question changed under it)',
   d => { d.stems[0].k = 'kdeadbeef'; },
   'matches no card'],

  ['anchor no longer matches the card',
   d => { d.stems[0].was = 'Something the card has never said'; },
   'anchor does not match'],

  ['the same key listed twice',
   d => { d.stems.push({ ...d.stems[0] }); },
   'listed twice'],

  /* The contract widened on 11 Aug: an entry may now also carry `fix`, which patches the
     card's BODY (passage, pairs, blank options) rather than its stem. So "neither" became
     "none of the three" and "both" stayed an error. These two read the applier's exact
     words on purpose — a selftest that matches loosely stops noticing when the message
     stops describing the rule. */
  /* Pick the entry by SHAPE, not by index. Both of these used d.stems[0], and the day a
     `sub`+`fix` entry was prepended to the file they started mutating the wrong kind of
     record and testing nothing — one passed the build outright. A fixture that depends on
     file order is a fixture that rots the next time somebody adds a line. */
  ['none of q, sub or fix given',
   d => { delete d.stems.find(x => x.q && !x.sub && !x.fix).q; },
   'needs one of'],

  ['both q and sub given',
   d => { d.stems.find(x => x.q && !x.sub && !x.fix).sub = [['a', 'b']]; },
   'at most one of'],

  ['a fix substitution that matches nothing',
   d => { const e = d.stems.find(x => x.fix && x.fix.text);
          e.fix.text = [['text that is not in the passage', 'x']]; },
   'matched'],

  ['a fix substitution that matches twice',
   d => { const e = d.stems.find(x => x.fix && x.fix.text);
          e.fix.text = [[' ', '_']]; },
   'needs at most 1'],

  ['fix.order that is not a permutation',
   d => { const e = d.stems.find(x => x.fix && x.fix.order); e.fix.order = [0, 0, 1, 2, 3]; },
   'not a permutation'],

  ['fix.order that changes nothing',
   d => { const e = d.stems.find(x => x.fix && x.fix.order);
          e.fix.order = e.fix.order.map((_, i) => i); },
   'the order it already has'],

  ['a substitution that matches nothing',
   d => { const e = d.stems.find(x => x.sub); e.sub = [['text that is not in the stem', 'x']]; },
   'matched 0 times'],

  ['a substitution that matches twice',
   d => { const e = d.stems.find(x => x.sub); e.sub = [['e', 'E']]; },
   'needs exactly 1'],

  ['a new stem identical to the old one',
   d => { const e = d.stems.find(x => x.q); e.q = e.was; },
   'identical to the old one'],
];

let failed = 0;
try {
  for (const [name, mut, needle] of CASES) {
    const d = JSON.parse(BACKUP);
    mut(d);
    fs.writeFileSync(REAL, JSON.stringify(d, null, 2));

    let out = '', died = false;
    try {
      execFileSync('node', ['audit/apply-migration.mjs'], { cwd: path.join(HERE, '..'), stdio: 'pipe' });
    } catch (e) {
      died = true;
      out = String(e.stdout ?? '') + String(e.stderr ?? '');
    }

    if (!died) {
      console.error(`✗ ${name}\n    the build PASSED — this gate is not firing`);
      failed++;
    } else if (!out.includes(needle)) {
      console.error(`✗ ${name}\n    the build died, but not for this reason (wanted "${needle}")\n    got: ${out.split('\n').filter(l => l.includes('✗')).slice(0, 2).join(' / ').slice(0, 200)}`);
      failed++;
    } else {
      console.log(`✓ ${name}`);
    }
  }
} finally {
  /* Always put the real file back, including on a crash — a self-test that leaves a
     deliberately corrupted stems.json on disk is worse than no self-test. */
  fs.writeFileSync(REAL, BACKUP);
}

/* And prove the restored file still builds, so the restore above is real. */
try {
  const ok = execFileSync('node', ['audit/apply-migration.mjs'], { cwd: path.join(HERE, '..'), stdio: 'pipe' });
  if (!String(ok).includes(`stems restored     : ${doc.stems.length} of ${doc.stems.length}`)) {
    console.error('✗ after restore, not every stem applied — stems.json was not put back correctly');
    failed++;
  } else console.log(`✓ restored stems.json still applies all ${doc.stems.length} stems`);
} catch (e) {
  console.error('✗ after restore the build FAILS — stems.json was not put back correctly');
  failed++;
}

console.log(failed ? `\n✗ ${failed} of ${CASES.length + 1} checks failed` : `\nall ${CASES.length + 1} stem gates proven live ✓`);
process.exit(failed ? 1 : 0);
