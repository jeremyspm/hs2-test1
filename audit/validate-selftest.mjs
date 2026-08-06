/* Prove every gate is LIVE.
   Runs validate.mjs against fixtures/tripwire.pack.js, which is built to trip each gate
   exactly once, and asserts the expected failures appear. A gate that has silently
   stopped firing fails here instead of quietly passing a broken pack. */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const fixture = path.join(HERE, 'fixtures', 'tripwire.pack.js');

try {
  execFileSync('node', ['validate.mjs', '--pack', fixture, '--summary'], { cwd: HERE, stdio: 'pipe' });
  console.error('✗ the tripwire fixture PASSED validation — the validator is not working at all');
  process.exit(1);
} catch { /* expected: it must fail */ }

const report = JSON.parse(fs.readFileSync(path.join(HERE, 'validate-report.json'), 'utf8'));
const got = report.failures;

/* what each gate must have caught, identified by a string in the failure */
const EXPECT = [
  ['G1', 'no `tier`'],
  ['G1', 'unknown tier'],
  /* Was 'requires a `why`' until the reframing pass renamed the field to `srcNote`.
     The gate kept firing; only this needle went stale, so the self-test reported a dead
     gate for a live one. When you rename a field, grep THIS list for its old name. */
  ['G1', 'requires a `srcNote`'],
  ['G1', 'duplicates `srcNote`'],
  ['G1', 'requires a non-empty `ev`'],
  /* The rail tier arrived with the 46 ported chains and went in without a tripwire —
     which is how 46 "unknown card type" failures sat in the report for a whole session
     and buried the one real G11 hit under them. Both halves of the rule are checked:
     a rail must say where it came from, and nothing else may wear the tier. */
  ['G1', 'requires a `from`'],
  ['G1', 'not a rail'],
  ['G2', 'unknown source'],
  ['G3', 'no such location'],
  ['G3', 'quote not present'],
  ['G4', '12345'],
  ['G5', 'atmospheric-pco2'],
  ['G5', 'atmospheric-po2'],
  ['G5', 'resp-membrane-thickness'],
  ['G5', 'anatomical-dead-space'],
  ['G6', 'unknown card type'],
  ['G6', 'exam sim'],
  ['G7', 'weak authority|student-peer'],
  ['G8', 'her own question says'],
  ['G9', 'floor is'],
  ['G9', 'no SAQ card'],
  /* An empty focus point is a hole and stays a hard failure; a shortfall the pack has
     DECLARED is not. These two prove the split did not collapse into "G9 never fires". */
  ['G9', 'NO cards at all'],
  ['G9', 'stale number'],
  ['G10', 'textbook-tier'],
  ['G11', 'refers to a figure'],
  ['G11', 'unresolved image marker'],
  ['G11', 'held:'],
];

let missing = 0;
for (const [gate, needle] of EXPECT) {
  const re = new RegExp(needle, 'i');
  const hit = got.some(f => f.gate === gate && (re.test(f.msg) || re.test(f.detail ?? '')));
  console.log(`${hit ? '✓' : '✗'} ${gate.padEnd(4)} ${needle}`);
  if (!hit) missing++;
}

const gatesFired = [...new Set(got.map(f => f.gate))].sort();
console.log(`\ngates that fired: ${gatesFired.join(', ')}`);
console.log(`${EXPECT.length - missing}/${EXPECT.length} expected detections present`);

if (missing) {
  console.error(`\n✗ ${missing} gate check(s) did NOT fire — those gates are dead code, not passing checks.`);
  process.exit(1);
}
console.log('\n✓ every gate is live');
