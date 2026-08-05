/* Phase 1c — recover the BN2 Formative Test keys from the model-answer deck.
   The deck is question/answer SLIDE PAIRS. The correct option is marked with b="1"
   (bold) in the run properties — not colour — so this is deterministic and needs no
   vision pass.

   Bold is ALSO used for emphasis inside question text ("which HELPS to move fluid
   through BOTH types of vessel"), so the key is the DIFFERENCE between the answer
   slide's bold runs and the question slide's, never the answer slide's bold alone.
   For written questions the answer slide is prose and is captured verbatim. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const corpus = JSON.parse(fs.readFileSync(path.join(HERE, 'corpus.json'), 'utf8'));
const registry = JSON.parse(fs.readFileSync(path.join(HERE, 'registry.json'), 'utf8'));

const DECK = Object.keys(registry).find(k => /BN2-FORMATIVE-TEST-MODEL-ANSWERS/i.test(k));
if (!DECK) { console.error('model-answer deck not found in registry'); process.exit(1); }

const slides = corpus.filter(u => u.src === DECK)
  .sort((a, b) => +a.loc.match(/\d+/)[0] - +b.loc.match(/\d+/)[0]);

const qnum = (t) => (t.match(/^Q(\d+)\s*[:.]/i) || [])[1] ?? null;
const norm = (s) => s.replace(/\s+/g, ' ').trim();

/* Group consecutive slides by the question number they announce.

   Slides with no Q-number are usually CONTINUATION slides of the current question —
   but not always. The deck's CO₂ cloze (really Q16) carries no "Q16:" prefix, so a
   naive inherit filed its answers under Q15, overwrote Q15's real model answer, and
   made Q16 vanish entirely.

   The deck's own convention resolves this: an ANSWER slide is a near-copy of its
   QUESTION slide once the newly-bolded tokens are removed. A consecutive unnumbered
   pair matching that shape is its own question, not a continuation. Anything that
   still carries bold marks on a true continuation slide is flagged `ambiguous` for
   human review rather than trusted. */
const sim = (a, b) => {
  const A = new Set(norm(a).toLowerCase().split(/\W+/).filter(Boolean));
  const B = new Set(norm(b).toLowerCase().split(/\W+/).filter(Boolean));
  if (!A.size || !B.size) return 0;
  let hit = 0;
  for (const w of A) if (B.has(w)) hit++;
  return hit / Math.max(A.size, B.size);
};
const startsOwnPair = (i) => {
  const a = slides[i], b = slides[i + 1];
  if (!b || qnum(a.t) || qnum(b.t)) return false;
  const bStripped = (b.bold ?? []).reduce((t, m) => t.split(m).join(' '), b.t);
  return (b.bold ?? []).length > 0 && sim(a.t, bStripped) >= 0.85;
};

const groups = [];
let cur = null;
slides.forEach((s, i) => {
  const n = qnum(s.t);
  if (n && (!cur || cur.q !== n)) { cur = { q: n, slides: [], inherited: [] }; groups.push(cur); }
  else if (!n && startsOwnPair(i)) { cur = { q: null, slides: [], inherited: [], ownPair: true }; groups.push(cur); }
  if (!cur) return;
  if (!n) cur.inherited.push(s.loc);
  cur.slides.push(s);
});

/* Number an unnumbered group only when elimination leaves exactly one candidate
   between its neighbours. Anything less certain stays unnumbered and is reported. */
for (let i = 0; i < groups.length; i++) {
  if (groups[i].q !== null) continue;
  const prev = +(groups[i - 1]?.q ?? 0);
  const next = +(groups[i + 1]?.q ?? 0);
  if (prev && next && next - prev === 2) { groups[i].q = String(prev + 1); groups[i].inferredNumber = true; }
}

const results = [];
for (const g of groups) {
  const [first, ...rest] = g.slides;
  if (!rest.length) { results.push({ q: g.q, kind: 'unpaired', why: 'only one slide for this question', slides: g.slides.map(s => s.loc) }); continue; }

  const qBold = new Set((first.bold ?? []).map(norm));
  const marks = [];          // ORDER-PRESERVING and duplicate-preserving: a T/F set
  const prose = [];          // answers as "FALSE, FALSE, TRUE" — deduping loses one
  let ambiguous = false;
  for (const s of rest) {
    const added = (s.bold ?? []).map(norm).filter(Boolean).filter(b => !qBold.has(b));
    // a pair-detected group is unnumbered by nature; its own answer slide is not
    // evidence of misattribution, so only true continuations of a numbered question flag
    if (added.length && !g.ownPair && g.inherited.includes(s.loc)) ambiguous = true;
    marks.push(...added.map(text => ({ text, loc: s.loc })));
    // an answer slide that restates the question is an option-key slide; one that does
    // not is a written model answer
    if (qnum(s.t) !== g.q || norm(s.t) !== norm(first.t)) prose.push({ loc: s.loc, t: s.t });
  }
  results.push({
    q: g.q,
    kind: ambiguous ? 'ambiguous' : marks.length ? 'marked' : 'written-only',
    ...(ambiguous ? { why: `bold marks found on continuation slide(s) ${g.inherited.join(', ')} that announce no question number — they may belong to a different question` } : {}),
    question: first.t,
    questionLoc: first.loc,
    inferredNumber: !!g.inferredNumber,
    inheritedSlides: g.inherited,
    key: marks,
    modelAnswer: prose,
  });
}

fs.writeFileSync(path.join(HERE, 'formative-keys.json'),
  JSON.stringify({ src: DECK, sha256: registry[DECK].sha256, results }, null, 1));

console.log('── BN2 FORMATIVE — MODEL ANSWER DECK ──────────────');
console.log(`  source: ${registry[DECK].label}  (${slides.length} slides)`);
console.log(`  ${groups.length} question groups\n`);
for (const r of results) {
  if (r.kind === 'unpaired') { console.log(`  Q${r.q.padEnd(3)} ⚠ ${r.why}`); continue; }
  const k = r.key.length ? r.key.map(m => m.text).join(' | ') : '(no bold diff — written answer)';
  const tag = r.q === null ? '??' : r.q;
  console.log(`  Q${String(tag).padEnd(3)}${r.inferredNumber ? '*' : ' '}${r.kind === 'ambiguous' ? '⚠ ' : '  '}${k.slice(0, 80)}`);
  if (r.kind === 'ambiguous') console.log(`        ⚠ ${r.why}`);
  if (r.modelAnswer.length && !r.key.length) {
    console.log(`        model answer: ${r.modelAnswer[0].t.slice(0, 78)}…`);
  }
}
const n = (k) => results.filter(r => r.kind === k).length;
console.log(`\n  ${n('marked')} key extracted · ${n('written-only')} written-answer only · ` +
            `${n('ambiguous')} AMBIGUOUS (needs review) · ${n('unpaired')} unpaired`);
console.log(`  question numbers seen: ${results.map(r => r.q ?? '??').join(', ')}`);
const inferred = results.filter(r => r.inferredNumber);
if (inferred.length) console.log(`  * ${inferred.length} number(s) inferred by elimination between neighbours: ${inferred.map(r => 'Q' + r.q).join(', ')}`);
console.log('wrote audit/formative-keys.json');
