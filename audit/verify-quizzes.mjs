/* Phase 1 gate — verify the question bank against the captures independently.
   The parser reporting its own success proves nothing. Every check here is computed a
   DIFFERENT way from parse-quizzes.mjs (naive counting, fixed known-good answers), so
   agreement is evidence rather than restatement. Any failure exits non-zero. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const EXPORT = path.resolve(ROOT, '..', '_inbox', 'Health Science 2 Export Module 1');
const { quizzes } = JSON.parse(fs.readFileSync(path.join(HERE, 'questions.json'), 'utf8'));
const images = JSON.parse(fs.readFileSync(path.join(HERE, 'question-images.json'), 'utf8'));

let fail = 0;
const bad = (msg) => { console.log(`  ✗ ${msg}`); fail++; };
const ok = (msg) => console.log(`  ✓ ${msg}`);

/* 1. every capture still hashes to what was parsed ------------------------- */
let drifted = 0;
for (const z of quizzes) {
  const p = path.join(EXPORT, z.file);
  if (!fs.existsSync(p)) { bad(`missing capture: ${z.file}`); continue; }
  const sha = crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
  if (sha !== z.sha256) { bad(`capture changed since parse: ${z.file}`); drifted++; }
}
if (!drifted) ok(`all ${quizzes.length} captures hash-match their parse`);

/* 2. question count, counted naively rather than by the parser's own logic -- */
let mismatch = 0;
for (const z of quizzes) {
  const html = fs.readFileSync(path.join(EXPORT, z.file), 'utf8');
  const naive = (html.match(/class=["']?[^"'>]*\bdisplay_question\b/g) || []).length;
  if (naive !== z.questions.length) {
    bad(`${z.title.slice(0, 40)}: naive count ${naive} ≠ parsed ${z.questions.length}`);
    mismatch++;
  }
}
if (!mismatch) ok(`question counts agree with an independent scan in all ${quizzes.length} quizzes`);

/* 3. known-good answers, read off the source by hand ----------------------- */
/* Each is a fact a human confirmed in the capture. If the extractor regresses, these
   break before anything ships. */
const EXPECT = [
  ['CVS2 THE HEART', 'The P wave on the electrocardiogram is associated with', 'right and left atrial depolarization'],
  ['CVS2 THE HEART', 'The first heart sound on the phono-cardiogram is associated with', 'closure of the atrioventricular valves'],
  ['DISEASES', 'lymph', null],   // presence check only
];
for (const [quizPart, qPart, wantAnswer] of EXPECT) {
  const z = quizzes.find(z => z.title.includes(quizPart));
  if (!z) { bad(`expected quiz containing "${quizPart}" not found`); continue; }
  const q = z.questions.find(q => q.q.toLowerCase().includes(qPart.toLowerCase()));
  if (!q) { bad(`in "${quizPart}": no question containing "${qPart}"`); continue; }
  if (wantAnswer === null) { ok(`"${quizPart}" contains a question about "${qPart}"`); continue; }
  const got = q.key?.correct ?? q.key?.pairs ?? null;
  if (!q.key || !JSON.stringify(q.key).toLowerCase().includes(wantAnswer.toLowerCase())) {
    bad(`key mismatch for "${qPart}": expected "${wantAnswer}", got ${JSON.stringify(q.key)}`);
  } else ok(`key correct: "${qPart.slice(0, 45)}…" → ${wantAnswer}`);
}

/* 4. no key may be empty, and every keyed question must have usable content -- */
const all = quizzes.flatMap(z => z.questions.map(q => ({ ...q, quiz: z.title })));
const emptyKeys = all.filter(q => q.key && JSON.stringify(q.key).length < 20);
if (emptyKeys.length) bad(`${emptyKeys.length} question(s) have a key object with no content`);
else ok('no empty key objects');

/* Empty question text is EITHER a parser bug OR a question the lecturer published
   blank. Those need opposite responses, so the source is re-read to tell them apart:
   blank-in-Canvas is reported and excluded from harvest, blank-only-after-parsing
   fails the gate. */
const emptyText = all.filter(q => !q.q || q.q.length < 5);
const parserBugs = [];
const blankInSource = [];
for (const q of emptyText) {
  const z = quizzes.find(z => z.title === q.quiz);
  const html = fs.readFileSync(path.join(EXPORT, z.file), 'utf8');
  const idx = html.indexOf('>' + q.n + '<');
  const near = idx === -1 ? '' : html.slice(idx, idx + 3000);
  const div = near.match(/class="question_text[^"]*"[^>]*>([\s\S]*?)<\/div>/);
  const sourceEmpty = div && !div[1].replace(/&nbsp;|\s/g, '');
  (sourceEmpty ? blankInSource : parserBugs).push(q);
}
if (parserBugs.length) bad(`${parserBugs.length} question(s) lost their text in parsing (parser bug)`);
else ok(`every question has text, or is blank in Canvas itself (${blankInSource.length} such)`);
for (const q of blankInSource) {
  console.log(`    ⚠ ${q.quiz.slice(0, 46)} — ${q.n} (${q.type}) is BLANK in her quiz;`);
  console.log(`      key is "${JSON.stringify(q.key?.correct ?? '')}" but there is no question. Not harvestable.`);
}

/* 5. essays must never carry a key (they are self-marked) ------------------ */
const essayWithKey = all.filter(q => q.type === 'essay_question' && q.key);
if (essayWithKey.length) bad(`${essayWithKey.length} essay question(s) carry a key — impossible, extractor bug`);
else ok('no essay question carries a fabricated key');

/* 6. image accounting ------------------------------------------------------ */
const refs = all.flatMap(q => [...q.q.matchAll(/\[\[IMG:([^\]]+)\]\]/g)].map(m => m[1]));
const dataRefs = refs.filter(r => /^[0-9a-f]{16}$/.test(r));
const namedRefs = refs.filter(r => !/^[0-9a-f]{16}$/.test(r));
const missing = [...new Set(dataRefs)].filter(r => !images[r]);
if (missing.length) bad(`${missing.length} embedded image reference(s) have no stored data`);
else ok(`${dataRefs.length} embedded image refs (${new Set(dataRefs).size} unique) all resolve`);
console.log(`    note: ${namedRefs.length} further image(s) are external URLs, not embedded — not recoverable offline`);

/* 7. totals -------------------------------------------------------------- */
const keyed = all.filter(q => q.key).length;
console.log('\n── SUMMARY ────────────────────────────────────────');
console.log(`  ${all.length} questions · ${keyed} keyed · ${all.length - keyed} unkeyed`);
console.log(`  unkeyed breakdown: ${all.filter(q => !q.key && q.type === 'essay_question').length} essay (expected), ` +
            `${all.filter(q => !q.key && q.type !== 'essay_question').length} other (needs review)`);

if (fail) { console.log(`\n✗ ${fail} check(s) FAILED`); process.exit(1); }
console.log('\n✓ all checks passed');
