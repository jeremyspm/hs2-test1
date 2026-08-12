/* Phase 2 — the validator. Gates G1–G10 from HS2-AUDIT-SPEC.md §5.
   EVERY GATE FAILS THE BUILD. Warnings are how the current pack got into this state.

     node audit/validate.mjs            validate pack.js
     node audit/validate.mjs --summary  counts only, no per-card detail  */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { loadPack } from './load-pack.mjs';
import { TIERS, SIM_TYPES, ALL_TYPES, WEAK_AUTHORITIES, COVERAGE, normQuote, claimText } from './schema.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const SUMMARY = process.argv.includes('--summary');

const registry = JSON.parse(fs.readFileSync(path.join(HERE, 'registry.json'), 'utf8'));
const corpus = JSON.parse(fs.readFileSync(path.join(HERE, 'corpus.json'), 'utf8'));
const quantities = JSON.parse(fs.readFileSync(path.join(HERE, 'quantities.json'), 'utf8'));
const packArg = process.argv.indexOf('--pack');
const { pack } = loadPack(packArg === -1 ? undefined : path.resolve(process.argv[packArg + 1]));

const corpusAt = new Map();
for (const u of corpus) corpusAt.set(`${u.src}\u0000${u.loc}`, u.t);

const failures = [];
const fail = (gate, where, msg, detail) => failures.push({ gate, where, msg, detail });

const items = [
  ...pack.cards.map((c, i) => ({ kind: 'card', i, o: c, where: `card #${i}` })),
  ...pack.glossary.map((g, i) => ({ kind: 'glossary', i, o: g, where: `glossary #${i}` })),
];
const label = (o) => (o.q ?? o.term ?? '').slice(0, 68);

/* ── G1 · every item has a legal tier and evidence ───────────────────────── */
for (const it of items) {
  const t = it.o.tier;
  if (!t) { fail('G1', it.where, 'no `tier`', label(it.o)); continue; }
  if (!TIERS[t]) { fail('G1', it.where, `unknown tier "${t}"`, label(it.o)); continue; }
  /* A rail is a ported chain, not a question: no stem, no key, so there is nothing to
     diff against a capture and `ev` cannot be the proof. What pins it is `from` — the
     hs2-module1 relation set it was built out of. Requiring that keeps this gate at full
     strength for rails rather than exempting them: a rail with no provenance still fails. */
  if (t === 'rail') {
    if (it.o.type !== 'rail') fail('G1', it.where, 'tier "rail" on an item that is not a rail', label(it.o));
    else if (!it.o.from) fail('G1', it.where, 'tier "rail" requires a `from` naming the hs2-module1 set it was ported from', label(it.o));
  } else if (t === 'textbook') {
    /* `srcNote`, not `why`. `why` is the explanation a reader gets when they answer a
       drill card wrong, and filing the sourcing reason there meant 123 auto-marked
       cards answered "why was I wrong?" with "no citation — standard textbook content
       written for the pack" — while also overwriting ~97 real authored explanations
       that pack.source.js already had. The gate is unchanged in strength: a textbook
       card must still state why it has no citation. It just no longer does it in the
       field the student reads. */
    if (!it.o.srcNote) fail('G1', it.where, '`textbook` tier requires a `srcNote` saying why it has no citation', label(it.o));
    if (it.o.why && it.o.why === it.o.srcNote) fail('G1', it.where, '`why` duplicates `srcNote` — `why` must explain the answer, not the sourcing', label(it.o));
  } else if (!it.o.ev || (Array.isArray(it.o.ev) && !it.o.ev.length)) {
    fail('G1', it.where, `tier "${t}" requires a non-empty \`ev\``, label(it.o));
  }
}

/* ── G2/G3 · evidence resolves, and every quote is verbatim at its location ─ */
/* Two evidence shapes, because there are two kinds of proof.
   A `taught` claim points into the CORPUS: {src, loc, quote}, checked below.
   A `verbatim` card points at a CAPTURE: {quiz, capture, captureSha, n} — its proof is
   that it reproduces her question and key exactly, which verify-harvest.mjs establishes
   by diffing against questions.json. Running corpus lookups on capture-shaped evidence
   reported 188 "unknown source undefined" failures against cards that are, in fact, the
   best-evidenced in the pack. */
const isCaptureEv = (ev) => ev && ev.quiz && ev.captureSha;
const evOf = (o) => {
  const raw = Array.isArray(o.ev) ? o.ev : o.ev ? [o.ev] : [];
  return raw.filter(e => !isCaptureEv(e));
};
const captureEvOf = (o) => {
  const raw = Array.isArray(o.ev) ? o.ev : o.ev ? [o.ev] : [];
  return raw.filter(isCaptureEv);
};

/* A verbatim card reproduces HER question, and that question can come from either
   place: a Canvas capture (capture-shaped evidence) or one of her documents, such as the
   Case Study Workbook (corpus-shaped evidence, quote-checked below). Requiring capture
   evidence specifically failed all eight case-study cards, whose questions are quoted
   from her workbook and are no less hers for it. */
for (const it of items) {
  if (it.o.tier !== 'verbatim') continue;
  const cap = captureEvOf(it.o);
  const corp = evOf(it.o);
  if (!cap.length && !corp.length) {
    fail('G2', it.where, '`verbatim` card has no evidence — needs a capture {quiz, captureSha, n} or a corpus quote', label(it.o));
  }
  for (const e of cap) {
    if (!e.n) fail('G2', it.where, `capture evidence for "${e.quiz}" names no question`, label(it.o));
  }
}

for (const it of items) {
  for (const ev of evOf(it.o)) {
    const src = registry[ev.src];
    if (!src) { fail('G2', it.where, `unknown source "${ev.src}"`, label(it.o)); continue; }
    const abs = path.resolve(ROOT, '..', src.path);
    if (!fs.existsSync(abs)) { fail('G2', it.where, `source file missing: ${src.path}`); continue; }
    const sha = crypto.createHash('sha256').update(fs.readFileSync(abs)).digest('hex');
    if (sha !== src.sha256) { fail('G2', it.where, `source changed since registration: ${src.path}`); continue; }

    if (!ev.quote) { fail('G3', it.where, `evidence for ${ev.src} ${ev.loc} has no \`quote\``, label(it.o)); continue; }
    const text = corpusAt.get(`${ev.src}\u0000${ev.loc}`);
    if (text === undefined) { fail('G3', it.where, `no such location: ${ev.src} ${ev.loc}`, label(it.o)); continue; }
    if (!normQuote(text).includes(normQuote(ev.quote))) {
      fail('G3', it.where, `quote not present at ${ev.src} ${ev.loc}`, `wanted ${JSON.stringify(ev.quote)}`);
    }

    /* G7 · a taught claim may not rest only on a weak authority */
    if (it.o.tier === 'taught') {
      const authorities = evOf(it.o).map(e => registry[e.src]?.authority).filter(Boolean);
      if (authorities.length && authorities.every(a => WEAK_AUTHORITIES.includes(a))) {
        fail('G7', it.where, `\`taught\` backed only by ${[...new Set(authorities)].join('/')}`, label(it.o));
      }
    }
  }
}

/* ── G4 · no naked numbers in verbatim/taught items ──────────────────────── */
const UNIT = String.raw`%|mmHg|mm\s?Hg|mL|ml|L\/min|litres|µm|um|m²|\/min|bpm|kPa|mEq|mm|cm|°C`;
const QRE = new RegExp(String.raw`(?<![\w.\-])(\d+(?:[.,]\d+)?)\s*(${UNIT})(?![\w])`, 'g');
for (const it of items) {
  /* `verbatim` is exempt: the numbers on those cards ARE hers — the card is a copy of
     her question and her key, proven by diff against the capture. Demanding a corpus
     quote for a figure she wrote into her own exam question would be incoherent. */
  if (it.o.tier !== 'taught') continue;
  const text = normQuote(claimText(it.o).join(' '));
  const covered = normQuote(evOf(it.o).map(e => e.quote ?? '').join(' '));
  for (const m of text.matchAll(QRE)) {
    if (!covered.includes(normQuote(m[1]))) {
      fail('G4', it.where, `quantity "${m[0].trim()}" is not inside any evidence quote — demote to \`textbook\` or cite it`, label(it.o));
    }
  }
}

/* ── G5 · declared canonical quantities ──────────────────────────────────── */
for (const it of items) {
  const text = normQuote(claimText(it.o).join(' '));
  for (const [id, q] of Object.entries(quantities)) {
    if (id.startsWith('_') || !q.match) continue;
    if (!new RegExp(q.match, 'i').test(text)) continue;
    const has = (v) => new RegExp(String.raw`(?<![\w.])${String(v).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\w.]*\d)`).test(text);

    for (const r of q.rejected ?? []) {
      if (has(r.value)) fail('G5', it.where, `${id}: "${r.value}${q.unit}" — ${r.why}`, label(it.o));
    }
    for (const n of q.needsHers ?? []) {
      if (has(n.value) && !has(q.canonical)) {
        fail('G5', it.where, `${id}: states "${n.value}${q.unit}" without her "${q.canonical}${q.unit}" — ${n.why}`, label(it.o));
      }
    }
    /* Fires only when the card uses the quantity's OWN unit, and is satisfied by any
       phrasing the declared pattern accepts. An earlier version demanded the literal
       "0.5-1" and fired on any unit at all, so it failed three correct cards that
       write "0.5 to 1 µm" and three more that never mention thickness. */
    if (q.requireRange) {
      const usesUnit = new RegExp(String.raw`\d\s*(?:${q.requireRange.unit})`, 'i').test(text);
      const hasRange = new RegExp(q.requireRange.pattern, 'i').test(text);
      if (usesUnit && !hasRange) {
        fail('G5', it.where, `${id}: gives a value in ${q.unit} without her full range "${q.canonical}" — ${q.requireRange.why}`, label(it.o));
      }
    }
    if (q.notTaught && new RegExp(String.raw`\d+(?:[.,]\d+)?\s*(?:${UNIT})`).test(text) && it.o.tier !== 'textbook') {
      fail('G5', it.where, `${id}: gives a figure, but ${q.why}`, label(it.o));
    }
  }
}

/* ── G6 · card types ─────────────────────────────────────────────────────── */
for (const it of items) {
  if (it.kind !== 'card') continue;
  if (!ALL_TYPES.includes(it.o.type)) fail('G6', it.where, `unknown card type "${it.o.type}"`, label(it.o));
}
const simMix = Object.keys(pack.exam?.mix ?? {});
for (const t of simMix) {
  if (!SIM_TYPES.includes(t)) {
    fail('G6', 'pack.exam.mix', `"${t}" is weighted in the exam sim but is not a question type that exists in this course`, `her 18 quizzes use MC, essay, matching, true/false, multiple-dropdown, multiple-answer, fill-in-blank — no ordering type`);
  }
}

/* ── G8 · a written card may not contradict a verbatim one ───────────────── */
/* Detecting contradiction between free text and an answer key in general is not
   reliable, and a gate that guesses is worse than no gate (see quantities.json
   _README). So this checks the case that IS decidable: two cards on the same
   criterion that both assert the same DECLARED quantity must assert the same value.
   Anything subtler is left to the Phase 4 human triage rather than faked here. */
/* Only values that are IDENTIFIABLE as this quantity count. A card about atmospheric air
   mentioning 760, 78 and 21 was being compared against her question's "99", reporting
   84 contradictions between numbers that are not the same measurement at all. A number
   counts only if the declared table already knows it as a value for that concept —
   canonical, alsoTaught, rejected, or needsHers. Anything else cannot be attributed to
   the concept without guessing, and guessing is what produced the 84. */
const knownValues = (q) => new Set([
  q.canonical,
  ...(q.alsoTaught ?? []).map(a => a.value),
  ...(q.rejected ?? []).map(r => r.value),
  ...(q.needsHers ?? []).map(n => n.value),
].filter(Boolean).map(String));

const assertedValues = (o) => {
  const text = normQuote(claimText(o).join(' '));
  const found = [];
  for (const [id, q] of Object.entries(quantities)) {
    if (id.startsWith('_') || !q.match) continue;
    if (!new RegExp(q.match, 'i').test(text)) continue;
    const known = knownValues(q);
    for (const m of text.matchAll(QRE)) {
      if (known.has(m[1])) found.push({ id, value: m[1] });
    }
  }
  return found;
};
const critAssertions = {};
for (const it of items) {
  if (it.kind !== 'card' || !it.o.crit) continue;
  for (const a of assertedValues(it.o)) {
    ((critAssertions[`${it.o.crit} ${a.id}`] ??= [])).push({ ...a, where: it.where, tier: it.o.tier, label: label(it.o) });
  }
}
for (const [key, hits] of Object.entries(critAssertions)) {
  const [crit, id] = key.split(' ');
  const verbatim = hits.filter(h => h.tier === 'verbatim');
  if (!verbatim.length) continue;
  const herValues = new Set(verbatim.map(h => h.value));
  for (const h of hits) {
    if (h.tier === 'verbatim') continue;
    if (!herValues.has(h.value)) {
      fail('G8', h.where, `${crit}/${id}: written card says "${h.value}" where her own question says "${[...herValues].join('/')}"`, h.label);
    }
  }
}

/* ── G9/G10 · coverage ───────────────────────────────────────────────────── */
/* A card can serve more than one criterion; `alsoCrit` holds the extras. Counting only
   `crit` reported resp-10 and lymph-4 as textbook-only when her own questions cover
   them — the coverage was there, the count was not looking at it. */
/* QUESTION CARDS ONLY. The 46 rails now carry a focus point too — every card in the
   pack is filed under a checklist item, which is what the Checklist page claims — but
   coverage is a claim about how much of HER material stands behind a point, and a chain
   to rebuild from memory is a different kind of study object. `PACK.thin` is computed
   before the rails are appended and the engine's perPoint() skips them, so counting them
   here made this gate the only one of the three disagreeing: it reported four points as
   carrying a "stale number" that was accurate. Three counts of one idea is the bug; the
   note in build.mjs beside its own `counts` is the other half of this. */
const critCards = {};
for (const c of pack.cards) {
  if (c.type === 'rail') continue;
  for (const id of [c.crit, ...(c.alsoCrit ?? [])].filter(Boolean)) {
    (critCards[id] ??= []).push(c);
  }
}
/* THE FLOOR IS DECLARED, NOT ENFORCED — and this gate has to agree with build.mjs or
   it reports 13 failures on a decision the pack made deliberately.

   The floor used to mean "author until every focus point has 6 cards". That standing
   order is exactly what produced the 338 manufactured cards the pack has since culled:
   under the rule that only her material may ship, a floor can be cleared only by MINING
   more of her material, and where there is none left the true number is the low one.

   So a shortfall is a failure only when the pack has NOT declared it. `PACK.thin` is
   the declaration the reader is shown, and the gate now checks the two things that can
   actually go wrong with it: an undeclared shortfall (the pack is quietly thin), and a
   declared count that disagrees with the cards really there (the declaration is stale,
   and is telling the reader a number that is not true). An EMPTY focus point stays a
   hard failure — that is a hole, not thin coverage. */
const declaredThin = new Map((pack.thin ?? []).map(t => [t.id, t]));
for (const crit of pack.criteria ?? []) {
  const cards = critCards[crit.id] ?? [];
  const floor = crit.blind ? COVERAGE.blindMin : COVERAGE.min;
  const thin = declaredThin.get(crit.id);
  if (!cards.length) {
    fail('G9', `criterion ${crit.id}`, 'NO cards at all — a focus point the reader cannot reach', crit.name);
  } else if (cards.length < floor && !thin) {
    fail('G9', `criterion ${crit.id}`, `${cards.length} card(s), floor is ${floor}${crit.blind ? ' (blind)' : ''} — and PACK.thin does not declare it, so the reader is never told`, crit.name);
  } else if (thin && thin.n !== cards.length) {
    fail('G9', `criterion ${crit.id}`, `PACK.thin declares ${thin.n} card(s) but the pack holds ${cards.length} — the reader is shown a stale number`, crit.name);
  }
  /* `blindNeedsSaq` goes the same way and for the same reason: resp-15 and resp-16 have
     zero questions from her anywhere in the course, so demanding a written-answer card on
     them is demanding an invented one. Declared-thin covers it. */
  if (crit.blind && COVERAGE.blindNeedsSaq && !thin && !cards.some(c => c.type === 'saq')) {
    fail('G9', `criterion ${crit.id}`, 'blind criterion has no SAQ card', crit.name);
  }
  if (cards.length && cards.every(c => c.tier === 'textbook') && !(pack.acknowledgedGaps ?? []).includes(crit.id)) {
    fail('G10', `criterion ${crit.id}`, 'covered ONLY by textbook-tier cards and not listed in pack.acknowledgedGaps', crit.name);
  }
}

/* ── G11 · a card may not reference a figure it does not have ─────────────── */
/* A stem reading "the structure labelled B is…" with no image is not a weaker card, it
   is an unanswerable one presenting itself as answerable — the plainest possible
   self-explaining-UI violation. Either the figure ships, or the card does not. */
const FIG_DEICTIC = /\b(figure|image|diagram|micrograph|photo|graph|picture)\b[^.]{0,40}\b(above|below|shown|here|following)\b|\b(above|below|shown)\b[^.]{0,25}\b(figure|image|diagram)\b|\blabell?ed\b|\bin the (image|figure|diagram)\b/i;
const LEFTOVER_MARKER = /\[\[IMG(:[^\]]*)?\]\]|\[image not available offline\]/;
for (const it of items) {
  if (it.kind !== 'card') continue;
  const c = it.o;
  const stem = [c.q, c.text].filter(Boolean).join(' ');
  const hasFig = !!c.fig;
  if (LEFTOVER_MARKER.test(JSON.stringify(c))) {
    fail('G11', it.where, 'an unresolved image marker survives in the card text', label(c));
  } else if (c.figMissing || c.figHold) {
    fail('G11', it.where, `held: ${c.figMissing ?? c.figHold}`, label(c));
  } else if (FIG_DEICTIC.test(stem) && !hasFig) {
    fail('G11', it.where, 'stem refers to a figure but the card carries none', label(c));
  }
}

/* ── report ──────────────────────────────────────────────────────────────── */
const byGate = {};
for (const f of failures) (byGate[f.gate] ??= []).push(f);
const GATE_NAMES = {
  G1: 'tier + evidence present', G2: 'source resolves & unchanged', G3: 'quote verbatim at location',
  G4: 'no naked numbers', G5: 'declared quantity conflicts', G6: 'legal card types',
  G7: 'no taught claim on a weak authority', G8: 'written vs her own key', G9: 'coverage floors',
  G10: 'criterion not textbook-only', G11: 'no card promises a missing figure',
};

console.log('══ VALIDATOR ═══════════════════════════════════════');
console.log(`  ${pack.cards.length} cards · ${pack.glossary.length} glossary · ${pack.criteria.length} criteria`);
/* Counted per KIND, not over `items`. The gates below rightly span cards and glossary
   together, but this line is read as "how much of the pack is not from her material" —
   and folding the 74 glossary entries (all `textbook` by construction) into the card
   tiers printed "textbook 99" for a pack with 25 textbook CARDS, in the same breath as
   "415 cards", from a tally summing to 489. The student-facing Sources tab always had
   this right; only the builder's own console was inflating it fourfold. */
const tally = (list) => {
  const t = {};
  for (const it of list) t[it.o.tier ?? '(none)'] = (t[it.o.tier ?? '(none)'] ?? 0) + 1;
  return t;
};
const tiers = tally(items.filter(it => it.kind === 'card'));
const glossTiers = tally(items.filter(it => it.kind === 'glossary'));
const fmt = (t) => Object.entries(t).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(' · ');
const sum = (t) => Object.values(t).reduce((a, b) => a + b, 0);
console.log(`  card tiers    : ${fmt(tiers)}   (${sum(tiers)})`);
console.log(`  glossary tiers: ${fmt(glossTiers)}   (${sum(glossTiers)})\n`);
if (sum(tiers) !== pack.cards.length) {
  console.error(`✗ tier tally ${sum(tiers)} does not equal ${pack.cards.length} cards — the summary is counting something that is not a card`);
  process.exit(1);
}

/* How many items each gate could even look at. A gate with nothing in scope must not
   print a green tick — "passing" and "had nothing to check" are different facts, and
   conflating them is how a dead gate looks healthy. */
const withEv = items.filter(it => evOf(it.o).length).length;
const tiered = items.filter(it => it.o.tier).length;
const SCOPE = {
  G1: items.length,
  G2: withEv, G3: withEv, G7: items.filter(it => it.o.tier === 'taught').length,
  G4: items.filter(it => ['verbatim', 'taught'].includes(it.o.tier)).length,
  G5: items.length, G6: pack.cards.length,
  G8: items.filter(it => it.o.tier === 'verbatim').length,
  G9: (pack.criteria ?? []).length, G10: tiered, G11: pack.cards.length,
};

for (const g of Object.keys(GATE_NAMES)) {
  const fs_ = byGate[g] ?? [];
  const scope = SCOPE[g] ?? 0;
  const mark = fs_.length ? '✗' : scope ? '✓' : '–';
  const verdict = fs_.length ? `${fs_.length} failure(s)` : scope ? 'pass' : 'NOTHING IN SCOPE';
  console.log(`${mark} ${g}  ${GATE_NAMES[g].padEnd(38)} ${verdict}`);
  if (!SUMMARY) {
    const show = fs_.slice(0, 6);
    for (const f of show) console.log(`     ${f.where}: ${f.msg}${f.detail ? `\n        ${f.detail}` : ''}`);
    if (fs_.length > show.length) console.log(`     … and ${fs_.length - show.length} more`);
  }
}

console.log(`\n${failures.length} total failure(s)`);
/* THE REPORT IS NAMED AFTER THE PACK IT DESCRIBES.
   validate-selftest.mjs runs this file against fixtures/tripwire.pack.js — a pack built
   to trip every gate — and that run was overwriting validate-report.json with its 39
   deliberate failures. The file then sat on disk, and got committed, describing a pack
   that looked broken and was not. So a `--pack` run writes its own report beside it, and
   the self-test reads that one: both runs still get a machine-readable result, and
   neither can be mistaken for the other. */
const reportPath = path.join(HERE, packArg === -1 ? 'validate-report.json' : 'validate-report.fixture.json');
fs.writeFileSync(reportPath, JSON.stringify({ failures, tiers, glossTiers }, null, 1));
console.log(`wrote audit/${path.basename(reportPath)}`);
if (failures.length) process.exit(1);
