/* Re-derive every number in ../HS2-CRAM-REBUILD-SPEC.md from the shipped pack.
   Run: node audit/measure-spec.mjs

   §6 of that spec asks for exactly this and gives the reason: a rebuild is about to be
   designed on top of numbers that were measured once, by hand, on a pack that has been
   rewritten since. "Any number that cannot be reproduced is deleted from the spec."

   HOW TO USE IT. Each claim below carries the value the DOCUMENT states next to the code
   that derives it from pack.js. Change the pack and a stale sentence in the spec fails
   here, which is the only way a planning document stays true to the thing it plans. When
   a claim legitimately moves, change the number in BOTH — the document is the deliverable,
   this file is the proof.

   It measures; it does not gate. run-all.mjs does not call it. */
import { loadPack } from './load-pack.mjs';

const { pack: P } = loadPack();

/* Rails are a different kind of study object — no criterion, appended after the coverage
   maths, never dealt as a question. Every count in the spec is about the DRILLABLE deck,
   which is why "415 cards" and "369 drillable" both appear in it and mean different things. */
const CARDS = P.cards;
const D = CARDS.filter((c) => c.type !== 'rail');
const CRITS = P.criteria ?? [];
const MARKED = ['mcq', 'match', 'cloze', 'tfset', 'order'];
const critsOf = (c) => [c.crit, ...(c.alsoCrit ?? [])].filter(Boolean);
const evsOf = (c) => [].concat(c.ev ?? []).filter(Boolean);
const partsOf = (c) => (c.blanks?.length || c.pairs?.length || c.statements?.length || c.points?.length || c.steps?.length || 1);

const perPoint = {};
for (const c of D) for (const id of critsOf(c)) perPoint[id] = (perPoint[id] ?? 0) + 1;
const primaryCount = {};
for (const c of D) if (c.crit) primaryCount[c.crit] = (primaryCount[c.crit] ?? 0) + 1;

/* ── Ring 0, exactly as §4 defines it ─────────────────────────────────────────
   "One card per focus point, chosen as the best-evidenced card for that point: a
   `verbatim` card that has been asked more than once, else any `verbatim` card, else the
   best available."

   Only cards whose PRIMARY subject the point is are eligible — that is what §6's C2 is
   about, and an alsoCrit mention would put a card about something else at the head of a
   focus point. Ties fall through to pack order, and two of them are real: cvs-3 has two
   five-part cards that are equally about it.

   WHEN RING 0 IS BUILT, THE ENGINE MUST USE THIS RULE AND NOT A SECOND COPY OF IT. Two
   implementations of "which card is the spine" that disagree would put a different card
   at the head of a focus point than the one measured here, and nothing would show it. */
const RANK = { verbatim: 3, taught: 2, textbook: 1 };
const spine = CRITS.map((cr) => {
  const mine = D.filter((c) => c.crit === cr.id);
  /* TIER FIRST, THEN THE REPEAT. Written the other way round — repeat first, as the
     sentence in §4 reads — it put a `taught` card that happens to carry two evidence
     entries at the head of resp-14, resp-16 and lymph-1, ahead of sixteen of Hannetjie's
     own questions. "Asked more than once" is a tie-break BETWEEN her questions, not a
     reason to prefer a lecture slide over one. */
  const best = mine.slice().sort((a, b) =>
    (RANK[b.tier] ?? 0) - (RANK[a.tier] ?? 0) ||
    (evsOf(b).length > 1) - (evsOf(a).length > 1) ||
    partsOf(b) - partsOf(a))[0];
  return { id: cr.id, card: best ?? null };
});

const claims = [
  ['§intro', 'cards in the shipped pack', 415, CARDS.length],
  ['§intro', 'drillable cards (the pack minus the rails)', 369, D.length],
  ['§1', 'machine-marked cards carrying an authored `why`', 293,
    D.filter((c) => MARKED.includes(c.type) && String(c.why ?? '').trim()).length],
  ['§1', 'machine-marked cards in total', 293, D.filter((c) => MARKED.includes(c.type)).length],

  ['§2', 'focus points the course publishes for Module 1 (36 criteria + the 2 case studies)', 38, CRITS.length],
  ['§2', 'questions in the paper', 35, P.exam.auto + P.exam.saq],
  ['§2', 'minutes', 65, P.exam.minutes],
  ['§2', 'cards on cvs-5, the biggest focus point', 88, perPoint['cvs-5']],
  ['§2', 'cards on resp-2', 48, perPoint['resp-2']],
  ['§2', 'cards on cvs-15', 41, perPoint['cvs-15']],
  ['§2', 'cards on resp-10, the smallest', 1, perPoint['resp-10']],
  ['§2', 'focus points holding 2 cards or fewer', 8,
    CRITS.filter((c) => (perPoint[c.id] ?? 0) <= 2).length],

  ['§3', 'drillable cards carrying more than one evidence entry (asked twice)', 10,
    D.filter((c) => evsOf(c).length > 1).length],
  ['§3', 'cards from the 50-mark formative', 11,
    D.filter((c) => evsOf(c).some((e) => /FORMATIVE CVS, LYMPHATIC/.test(e.quiz ?? ''))).length],
  ['§3', 'focus points those 11 cards touch, alsoCrit counted', 22,
    new Set(D.filter((c) => evsOf(c).some((e) => /FORMATIVE CVS, LYMPHATIC/.test(e.quiz ?? ''))).flatMap(critsOf)).size],
  ['§3', 'drillable cards that are `verbatim` — her own questions', 321,
    D.filter((c) => c.tier === 'verbatim').length],

  ['§4', 'cards in Ring 0 — one per focus point', 38, spine.filter((s) => s.card).length],
  ['§4', 'of those, one of her own questions', 35, spine.filter((s) => s.card?.tier === 'verbatim').length],
  ['§4', 'of those, pinned to her lecture', 2, spine.filter((s) => s.card?.tier === 'taught').length],
  ['§4', 'of those, background reading', 1, spine.filter((s) => s.card?.tier === 'textbook').length],
  ['§4', 'focus points declared thin (below the old authoring floor)', 12, (P.thin ?? []).length],
  ['§4', 'cards in Ring 1 — every card on a focus point holding fewer than 6', 29,
    D.filter((c) => critsOf(c).some((id) => (perPoint[id] ?? 0) < 6)).length],

  ['§6 C1', 'cards carrying no focus point at all — CLOSED 11 Aug', 0,
    D.filter((c) => !critsOf(c).length).length],
  ['§6 C2', 'focus points that are no card\'s primary subject — CLOSED 11 Aug', 0,
    CRITS.filter((c) => !primaryCount[c.id]).length],
  ['§6 C3', 'focus points with at least one written answer', 5,
    new Set(D.filter((c) => c.type === 'saq').flatMap(critsOf)).size],
  ['§6 C3', 'written-answer cards in the pack', 18, D.filter((c) => c.type === 'saq').length],
  ['§6 C4', 'self-marked questions of hers still carrying no model answer', 0,
    D.filter((c) => c.selfMark && !String(c.a ?? '').trim()).length],
  ['§6 C5', 'focus points whose spine card is not one of her questions', 3,
    spine.filter((s) => s.card && s.card.tier !== 'verbatim').length],
  ['§6 C5', 'of those, declared to the reader (blind flag or acknowledged gap)', 3,
    spine.filter((s) => s.card && s.card.tier !== 'verbatim')
      .filter((s) => { const cr = CRITS.find((c) => c.id === s.id); return cr.blind || cr.acknowledgedGap; }).length],
  ['§6 C6', 'most focus points claimed by one card', 10, Math.max(...D.map((c) => critsOf(c).length))],
  ['§6 C6', 'average focus points per card (×100, to keep this integer)', 159,
    Math.round(100 * D.reduce((a, c) => a + critsOf(c).length, 0) / D.length)],
  ['§6 C6', 'cards claiming more focus points than they have parts to test', 0,
    D.filter((c) => critsOf(c).length > partsOf(c) + 3).length],

  ['§8', 'cloze cards, against a paper that is 40% drop-down', 19,
    D.filter((c) => c.type === 'cloze').length],
];

const drift = claims.filter(([, , spec, got]) => spec !== got);
const pad = (s, n) => String(s).padEnd(n);

console.log('══ SPEC vs PACK ════════════════════════════════════');
let section = null;
for (const [sec, what, spec, got] of claims) {
  if (sec !== section) { console.log(''); section = sec; }
  const ok = spec === got;
  console.log(`  ${ok ? '✓' : '✗'} ${pad(sec, 7)} ${pad(got, 5)} ${ok ? ' ' : `(spec says ${spec})`.padEnd(18)} ${what}`);
}

console.log('\n── Ring 0, card by card ───────────────────────────');
for (const s of spine) {
  const c = s.card;
  const q = String(c?.q ?? '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  console.log(`  ${pad(s.id, 9)} ${pad(c ? c.tier : 'NONE', 9)} ${pad(c ? c.type : '', 6)} ${evsOf(c ?? {}).length > 1 ? '×2 ' : '   '}${q.slice(0, 74)}`);
}

console.log('\n── every focus point, by supply ───────────────────');
for (const cr of [...CRITS].sort((a, b) => (perPoint[b.id] ?? 0) - (perPoint[a.id] ?? 0))) {
  console.log(`  ${pad(cr.id, 9)} ${String(perPoint[cr.id] ?? 0).padStart(3)} cards ${String(primaryCount[cr.id] ?? 0).padStart(3)} primary${
    (P.thin ?? []).some((t) => t.id === cr.id) ? '  THIN' : '      '}${cr.blind ? '  never practised' : ''}  ${cr.name ?? ''}`);
}

if (drift.length) {
  console.error(`\n✗ ${drift.length} of ${claims.length} claim(s) in HS2-CRAM-REBUILD-SPEC.md no longer match the pack.`);
  console.error('  Update the document and the number here together, or delete the claim from both.');
  process.exit(1);
}
console.log(`\n✓ all ${claims.length} numbers in HS2-CRAM-REBUILD-SPEC.md reproduce from pack.js`);
