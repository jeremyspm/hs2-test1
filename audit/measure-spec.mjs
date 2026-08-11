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
import { spineOf, partsOf, ringCounts } from './spine.mjs';
import { ckey } from './ckey.mjs';

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

const perPoint = {};
for (const c of D) for (const id of critsOf(c)) perPoint[id] = (perPoint[id] ?? 0) + 1;
const primaryCount = {};
for (const c of D) if (c.crit) primaryCount[c.crit] = (primaryCount[c.crit] ?? 0) + 1;

/* Ring 0 — the spine. The rule lives in spine.mjs, which the pack builder uses too, so
   the 38 cards printed below are the 38 the tool leads with. Ties fall through to pack
   order, and one of them is real: cvs-3 has two five-part cards equally about it. */
const spine = spineOf(P);

const claims = [
  ['§intro', 'cards in the shipped pack', 414, CARDS.length],
  ['§intro', 'drillable cards (the pack minus the rails)', 368, D.length],
  ['§1', 'machine-marked cards carrying an authored `why`', 293,
    D.filter((c) => MARKED.includes(c.type) && String(c.why ?? '').trim()).length],
  ['§1', 'machine-marked cards in total', 293, D.filter((c) => MARKED.includes(c.type)).length],

  ['§2', 'focus points the course publishes for Module 1 (36 criteria + the 2 case studies)', 38, CRITS.length],
  ['§2', 'questions in the paper', 35, P.exam.auto + P.exam.saq],
  ['§2', 'minutes', 65, P.exam.minutes],
  ['§2', 'cards on cvs-5, the biggest focus point', 87, perPoint['cvs-5']],
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
  /* The ring sizes as the engine DEALS them, from the same module the engine is gated
     against — not "every card on a thin focus point", which double-counts the 15 spine
     cards that sit on one and are dealt in Ring 0. */
  /* A round was inserted at index 1 on 11 Aug — the written half. Every count behind it
     shifted, which is exactly what this file exists to catch and did. */
  ['§4', 'cards in Ring 1 — the written half (the case studies the SAQs come from)', 19, ringCounts(P, ckey)[1]],
  ['§4', 'cards in Ring 2 — the thin points, spine cards excluded', 15, ringCounts(P, ckey)[2]],
  ['§4', 'cards in Ring 3 — the rest of her questions', 264, ringCounts(P, ckey)[3]],
  ['§4', 'cards in Ring 4 — background', 77, ringCounts(P, ckey)[4]],

  ['§6 C1', 'cards carrying no focus point at all — CLOSED 11 Aug', 0,
    D.filter((c) => !critsOf(c).length).length],
  ['§6 C2', 'focus points that are no card\'s primary subject — CLOSED 11 Aug', 0,
    CRITS.filter((c) => !primaryCount[c.id]).length],
  /* The three rows of the C3 table. A `saq` carries a marking schedule; a `selfMark` flash
     is one of her essay questions with an answer written for this pack and no schedule,
     because Canvas published none. Both are written practice; only one can be marked. */
  ['§6 C3', 'focus points with a written answer AND a marking schedule', 5,
    new Set(D.filter((c) => c.type === 'saq').flatMap(critsOf)).size],
  ['§6 C3', 'focus points with written practice but no schedule', 15,
    (() => {
      const sched = new Set(D.filter((c) => c.type === 'saq').flatMap(critsOf));
      return new Set(D.filter((c) => c.selfMark).flatMap(critsOf)).size
        - [...new Set(D.filter((c) => c.selfMark).flatMap(critsOf))].filter((id) => sched.has(id)).length;
    })()],
  ['§6 C3', 'focus points with nothing to write at all', 18,
    (() => {
      const any = new Set(D.filter((c) => c.type === 'saq' || c.selfMark).flatMap(critsOf));
      return CRITS.filter((c) => !any.has(c.id)).length;
    })()],
  ['§6 C3', 'written-answer cards carrying a marking schedule', 17, D.filter((c) => c.type === 'saq').length],
  ['§6 C3', 'her essay questions reproduced with a pack-written answer', 39, D.filter((c) => c.selfMark).length],
  ['§6 C4', 'self-marked questions of hers still carrying no answer at all', 0,
    D.filter((c) => c.selfMark && !String(c.a ?? '').trim()).length],
  ['§6 C5', 'focus points whose spine card is not one of her questions', 3,
    spine.filter((s) => s.card && s.card.tier !== 'verbatim').length],
  ['§6 C5', 'of those, declared to the reader (blind flag or acknowledged gap)', 3,
    spine.filter((s) => s.card && s.card.tier !== 'verbatim')
      .filter((s) => { const cr = CRITS.find((c) => c.id === s.id); return cr.blind || cr.acknowledgedGap; }).length],
  ['§6 C6', 'most focus points claimed by one card', 10, Math.max(...D.map((c) => critsOf(c).length))],
  ['§6 C6', 'average focus points per card (×100, to keep this integer)', 160,
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
