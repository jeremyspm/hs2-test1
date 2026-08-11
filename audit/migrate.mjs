/* Phase 4 item 2 — triage the 392 existing cards onto the evidence schema.

   This does NOT author content. For each existing card it decides a TIER from evidence
   that already exists, and where a card cites a source it tries to find a quote in that
   source supporting the card's own words. Anything it cannot substantiate is demoted to
   `textbook` with a stated reason — never left as an unmarked assertion.

   Output: audit/migration.json — a per-card proposal, reviewable before it is applied.
   Applying it to pack.js is a separate, explicit step (apply-migration.mjs). */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPack } from './load-pack.mjs';
import { normQuote, claimText } from './schema.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const registry = JSON.parse(fs.readFileSync(path.join(HERE, 'registry.json'), 'utf8'));
const corpus = JSON.parse(fs.readFileSync(path.join(HERE, 'corpus.json'), 'utf8'));
const quantities = JSON.parse(fs.readFileSync(path.join(HERE, 'quantities.json'), 'utf8'));
/* Triage runs against the pinned original, not the generated pack.js. */
const { pack } = loadPack(path.join(HERE, '..', 'pack.source.js'));

/* ── resolving the old free-text `src` strings ───────────────────────────────
   Eight of the ten distinct heads match a registry label directly. The two that do not
   are named differently in the registry and are aliased explicitly rather than by
   fuzzy matching, because both were mis-resolved once already. */
const ALIASES = {
  'module 1 formative test (canvas)': 'SRC-MODULE-1-FORMATIVE-TEST-HEALTH-SCIENCE-2',
  'bn2 formative test pdf model answers': 'SRC-BN2-FORMATIVE-TEST-PDF-MODEL-ANSWERS',
};
/* An alias naming a source that does not exist is WORSE than no alias at all. The second
   entry above read SRC-PDF-OF-IN-CLASS-FORMATIVE-MODEL-ANSWERS until 11 Aug 2026, which is
   in no registry: `resolveSrc` returned it, `findQuote` filtered a corpus that holds no
   unit with that id, found nothing, and thirteen cards citing her formative model answers
   were demoted to `textbook` carrying the sentence "no phrase from this card appears in
   that source — the citation was never verified". The citation was never SEARCHED. The
   failure is silent by construction, because an alias exists precisely for the ids that do
   not match a label, so there is nothing left to disagree with it. */
for (const [head, id] of Object.entries(ALIASES)) {
  if (!registry[id]) {
    console.error(`✗ alias "${head}" resolves to ${id}, which is in no registry — every card citing it would be demoted with a reason that is not true.`);
    process.exit(1);
  }
}
const labels = Object.entries(registry).map(([id, v]) => [id, v.label.toLowerCase()]);

function resolveSrc(src) {
  if (!src) return null;
  const head = src.split(/\s+slides?\s|\s—\s|,\s/)[0].trim().toLowerCase();
  if (ALIASES[head]) return { id: ALIASES[head], head, via: 'alias' };
  const hit = labels.find(([, l]) => l === head) ?? labels.find(([, l]) => l.includes(head) || head.includes(l));
  return hit ? { id: hit[0], head, via: 'label' } : { id: null, head, via: 'unresolved' };
}

/* The old citations name a slide or page; capture it so a quote search can be scoped
   to that location first, then widened to the whole document. */
function citedLocs(src, srcId) {
  const out = [];
  const kind = registry[srcId]?.kind;
  const unit = kind === 'pdf' ? 'page' : kind === 'pptx' ? 'slide' : 'para';
  for (const m of src.matchAll(/slides?\s+(\d+)(?:\s*[–-]\s*(\d+))?/gi)) {
    const a = +m[1], b = m[2] ? +m[2] : a;
    for (let i = a; i <= b; i++) out.push(`${unit} ${i}`);
  }
  return out;
}

/* ── find a supporting quote ─────────────────────────────────────────────────
   A card is `taught` only if a distinctive phrase from the card appears verbatim in the
   cited source. Distinctive = a run of words that is not generic. The longest matching
   run is returned as the quote, so the evidence is the strongest available, not the
   first thing that happened to match. */
const STOP = new Set('the a an of to in is are and or for with that this it its by as at from on be can not into out'.split(' '));
function candidatePhrases(text) {
  const clean = normQuote(String(text).replace(/<[^>]+>/g, ' ').replace(/\[\[[^\]]*\]\]/g, ' '));
  const words = clean.split(/\s+/).filter(Boolean);
  const out = [];
  for (const len of [9, 7, 5, 4]) {
    for (let i = 0; i + len <= words.length; i++) {
      const run = words.slice(i, i + len);
      if (run.filter(w => !STOP.has(w.toLowerCase())).length < Math.ceil(len / 2)) continue;
      out.push(run.join(' '));
    }
  }
  return out;
}

/* Strategy B — distinctive tokens.
   Slide decks are tabular: her atmospheric-air slide reads "P | O2 | | 159.6 mm Hg | P |
   CO2 | | | 0.2 mm Hg", so no run of words from a prose card will ever appear in it
   verbatim. Phrase matching alone therefore fails precisely on the slides that carry the
   numbers, and would strip correct citations off correctly-sourced cards.

   So: collect the card's distinctive tokens — decimals, multi-digit numbers, and rare
   capitalised terms — and look for a single source unit containing enough of them. The
   QUOTE IS STILL TAKEN FROM THE SOURCE, never from the card, so the evidence remains a
   string that must exist on that slide. */
const distinctiveTokens = (text) => {
  const t = normQuote(String(text).replace(/<[^>]+>/g, ' '))
    .replace(/[₀₁₂₃₄₅₆₇₈₉]/g, d => '₀₁₂₃₄₅₆₇₈₉'.indexOf(d).toString());
  const nums = [...t.matchAll(/(?<![\w.])(\d+\.\d+|\d{2,})(?![\w.]*\d)/g)].map(m => m[1]);
  const terms = [...t.matchAll(/\b([A-Z][a-z]{6,}|[a-z]{9,})\b/g)].map(m => m[1].toLowerCase());
  return { nums: [...new Set(nums)], terms: [...new Set(terms)] };
};

function tokenQuote(card, pool) {
  const { nums, terms } = distinctiveTokens(claimText(card).join(' '));
  if (nums.length < 2 && terms.length < 3) return null;
  let best = null;
  for (const u of pool) {
    const ut = normQuote(u.t);
    const utl = ut.toLowerCase();
    const hitNums = nums.filter(n => new RegExp(String.raw`(?<![\w.])${n.replace('.', '\\.')}(?![\w.]*\d)`).test(ut));
    const hitTerms = terms.filter(w => utl.includes(w));
    const score = hitNums.length * 2 + hitTerms.length;
    if (hitNums.length < 2 && hitTerms.length < 3) continue;
    if (!best || score > best.score) {
      /* quote = the smallest span of HER text covering the matched tokens */
      const idxs = [...hitNums, ...hitTerms]
        .map(tok => utl.indexOf(tok.toLowerCase())).filter(i => i >= 0);
      const lo = Math.max(0, Math.min(...idxs) - 10);
      const hi = Math.min(ut.length, Math.max(...idxs) + 24);
      best = { score, loc: u.loc, quote: ut.slice(lo, hi).trim(), matched: { nums: hitNums, terms: hitTerms } };
    }
  }
  return best;
}

/* In a Canvas results print, a self-marked question's model answer appears under the
   label "Your Answer:" — NOT "model answer", which is why a string search for the latter
   found nothing and led to the wrong conclusion that this PDF held no answers. It holds
   eight, several prefixed "Self mark!", in unmistakably instructional voice.

   The distinction matters: matching a card against her MODEL ANSWER substantiates the
   card's answer. Matching it against her QUESTION text substantiates only that she asked
   about the topic — the same weakness as matching a learning-objective line. */
const answerSpans = (text) => {
  const out = [];
  for (const m of String(text).matchAll(/Your Answer:\s*([\s\S]{25,600}?)(?=\bUnanswered\b|\bQuestion \d+\b|Your Answer:|$)/g)) {
    out.push(normQuote(m[1]));
  }
  return out;
};

function findQuote(card, srcId, locs) {
  if (!srcId) return null;
  const scoped = corpus.filter(u => u.src === srcId && (!locs.length || locs.includes(u.loc)));
  const wide = corpus.filter(u => u.src === srcId);

  /* Prefer evidence drawn from a model-answer span, wherever one exists. */
  const phrasesAll = candidatePhrases(claimText(card).join(' '));
  for (const pool of [scoped, wide]) {
    for (const u of pool) {
      const spans = answerSpans(u.t);
      if (!spans.length) continue;
      for (const p of phrasesAll) {
        const np = normQuote(p).toLowerCase();
        if (np.length < 18) continue;
        const span = spans.find(s => s.toLowerCase().includes(np));
        if (span) {
          /* Same rule as the phrase path: the quote is the SOURCE's characters. Her
             model answer writes "neural regulation" where the card writes "NEURAL", and
             returning the card's casing produced evidence the validator then rejected. */
          const hay = normQuote(u.t);
          const at = hay.toLowerCase().indexOf(np);
          if (at === -1) continue;
          return { src: srcId, loc: u.loc, quote: hay.slice(at, at + np.length),
                   scope: pool === scoped ? 'cited' : 'document', how: 'model-answer', strong: true };
        }
      }
    }
  }
  const phrases = candidatePhrases(claimText(card).join(' '));
  for (const pool of [scoped, wide]) {
    if (!pool.length) continue;
    for (const p of phrases) {
      const np = normQuote(p).toLowerCase();
      if (np.length < 18) continue;
      const hit = pool.find(u => normQuote(u.t).toLowerCase().includes(np));
      if (hit) {
        /* Store the quote AS IT APPEARS IN HER SOURCE, not as the card writes it.
           Matching is case-insensitive so a card that writes "macrophages" still finds
           her "Macrophages" — but recording the card's casing produced evidence that
           then failed the validator's exact check. The quote is evidence FROM the
           source; it must be the source's own characters. */
        const hay = normQuote(hit.t);
        const at = hay.toLowerCase().indexOf(np);
        const sourceQuote = hay.slice(at, at + np.length);
        /* If this document contains model answers at all, a match that landed OUTSIDE
           one of them is question text, and substantiates the stem but not the answer. */
        const docHasAnswers = wide.some(u => answerSpans(u.t).length);
        return { src: srcId, loc: hit.loc, quote: sourceQuote, scope: pool === scoped ? 'cited' : 'document',
                 how: docHasAnswers ? 'phrase-question-only' : 'phrase', strong: !docHasAnswers };
      }
    }
    const tok = tokenQuote(card, pool);
    if (tok) {
      /* Numeric agreement is conclusive: five decimals matching one slide is not
         coincidence. Matching only on long words is NOT — three of those landed on
         "15. Discuss the effect of emotions…", a learning-objective line, which proves
         the topic is on the slide and says nothing about whether the claim is right.
         Strong matches promote; weak ones are recorded as candidate evidence for
         review rather than either promoting or being thrown away. */
      const strong = tok.matched.nums.length >= 2;
      return {
        src: srcId, loc: tok.loc, quote: tok.quote,
        scope: pool === scoped ? 'cited' : 'document',
        how: strong ? 'tokens' : 'tokens-weak', matched: tok.matched, strong,
      };
    }
  }
  return null;
}

/* ── HER PAPERS ARE NOT HER LECTURE ──────────────────────────────────────────
   This file had three possible answers — `taught`, `textbook`, `unverified` — and no
   way to reach `verbatim` at all. That is not a missing feature, it is a category error
   the whole tool was built on top of: triage asks "does the cited source SUPPORT this
   card's claim", which is a question about content, and `verbatim` is a question about
   ORIGIN. So every card that came out of a paper Hannetjie SET, but arrived through this
   path rather than through the Canvas-capture harvest, was capped at `taught` and told
   the reader "Straight from Hannetjie's lecture material".

   The cost was not cosmetic. `tier` is the first tie-break in audit/spine.mjs, so a
   `taught` card can never lead a focus point however good it is; and ringOfCard deals
   non-verbatim cards LAST, under a heading that says background reading. Two of her own
   Module 1 formative SAQs — the artery-vs-vein micrograph (5 marks) and the inspired-air
   particles question (3 marks) — were therefore dealt dead last, in Ring 4, as background
   reading, in a tool built to frontload exactly that kind of question.

   The rule is deliberately narrow, because the one thing this pack must never do is
   claim our writing is hers. BOTH must hold:

     1. the source is a paper she SET, listed by id below — not a lecture, not a
        workbook, not a peer discussion;
     2. the evidence is HERS AND THIS CARD'S, by one of two mechanically checkable
        routes — the located quote appears in the card's own question stem, or it came
        out of a "Your Answer:" span, which in a Canvas results print is her model answer
        to her own question.

   Everything else the triage promoted stays `taught`, including two cards whose quote
   matched her answer PROSE rather than their stem: her paper supports what they say,
   which is what `taught` means, and that is as far as the evidence goes. */
const HER_PAPERS = new Set([
  'SRC-MODULE-1-FORMATIVE-TEST-HEALTH-SCIENCE-2',   // MODULE 1 : Formative Test (Canvas results print)
  'SRC-BN2-FORMATIVE-TEST-PDF-MODEL-ANSWERS',       // BN2 Formative Test PDF Model Answers
]);
const flat = (s) => normQuote(String(s ?? '').replace(/<[^>]+>/g, ' ')).toLowerCase().replace(/\s+/g, ' ').trim();

function herPaper(card, srcId, ev) {
  if (!HER_PAPERS.has(srcId) || !ev) return false;
  if (ev.how === 'model-answer') return true;                  // her marking schedule
  return flat(card.q).includes(flat(ev.quote));                // her stem, in this card
}

/* ── declared-quantity fixes ────────────────────────────────────────────────
   The contradictions the validator already reports, with the corrected value, so the
   apply step can rewrite them rather than merely flagging. */
function quantityIssues(card) {
  const text = normQuote(claimText(card).join(' '));
  const out = [];
  for (const [id, q] of Object.entries(quantities)) {
    if (id.startsWith('_') || !q.match) continue;
    if (!new RegExp(q.match, 'i').test(text)) continue;
    const has = (v) => new RegExp(String.raw`(?<![\w.])${String(v).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\w.]*\d)`).test(text);
    for (const r of q.rejected ?? []) {
      if (has(r.value)) out.push({ id, kind: 'rejected', from: r.value, to: q.canonical, unit: q.unit, why: r.why });
    }
    for (const n of q.needsHers ?? []) {
      if (has(n.value) && !has(q.canonical)) out.push({ id, kind: 'needsHers', from: n.value, to: q.canonical, unit: q.unit, why: n.why });
    }
    if (q.notTaught && new RegExp(String.raw`\d`).test(text)) out.push({ id, kind: 'notTaught', why: q.why });
  }
  return out;
}

/* ── triage ─────────────────────────────────────────────────────────────── */
const items = [
  ...pack.cards.map((c, i) => ({ kind: 'card', i, o: c })),
  ...pack.glossary.map((g, i) => ({ kind: 'glossary', i, o: g })),
];

const proposals = [];
for (const it of items) {
  const src = it.o.src ?? null;
  const r = resolveSrc(src);
  const locs = r?.id ? citedLocs(src, r.id) : [];
  let ev = r?.id ? findQuote(it.o, r.id, locs) : null;

  /* A card may carry figures its primary quote does not cover (G4). Look for a second
     unit of the SAME source that contains the uncovered value and attach it as extra
     evidence; if none exists the card cannot claim `taught` for that figure and is
     demoted below. Finding it is better than demoting — her atmospheric-air card gives
     78% and 21%, which are on her next slide, not the one the quote came from. */
  let extraEv = [];
  if (ev) {
    const claim = normQuote(claimText(it.o).join(' '));
    const covered = normQuote(ev.quote);
    const units = corpus.filter(u => u.src === r.id);
    const UNIT_RE = String.raw`%|mmHg|mm\s?Hg|mL|ml|L\/min|litres|µm|um|m²|\/min|bpm|kPa|mEq|mm|cm|°C`;
    for (const m of claim.matchAll(new RegExp(String.raw`(?<![\w.\-])(\d+(?:[.,]\d+)?)\s*(${UNIT_RE})(?![\w])`, 'g'))) {
      if (covered.includes(m[1])) continue;
      if (extraEv.some(e => normQuote(e.quote).includes(m[1]))) continue;
      const val = m[1];
      const hit = units.find(u => new RegExp(String.raw`(?<![\w.])${val.replace('.', '\\.')}(?![\w.]*\d)`).test(normQuote(u.t)));
      if (hit) {
        const hay = normQuote(hit.t);
        const at = hay.search(new RegExp(String.raw`(?<![\w.])${val.replace('.', '\\.')}(?![\w.]*\d)`));
        extraEv.push({ src: r.id, loc: hit.loc, quote: hay.slice(Math.max(0, at - 24), at + 40).trim() });
      }
    }
  }
  const qIssues = quantityIssues(it.o);
  const auth = r?.id ? registry[r.id]?.authority : null;

  /* A figure that no unit of the cited source contains cannot be `taught`, however good
     the rest of the card's evidence is. Demote rather than ship an uncited number. */
  let uncited = null;
  if (ev) {
    const claim2 = normQuote(claimText(it.o).join(' '));
    const cov = normQuote([ev, ...extraEv].map(e => e.quote).join(' '));
    const U = String.raw`%|mmHg|mm\s?Hg|mL|ml|L\/min|litres|µm|um|m²|\/min|bpm|kPa|mEq|mm|cm|°C`;
    for (const m of claim2.matchAll(new RegExp(String.raw`(?<![\w.\-])(\d+(?:[.,]\d+)?)\s*(${U})(?![\w])`, 'g'))) {
      if (!cov.includes(m[1])) { uncited = m[0].trim(); break; }
    }
  }
  const weak = ev && ev.strong === false;
  let tier, why, candidateEv = null;
  if (ev && !weak && !uncited && auth && !['student-peer', 'external'].includes(auth)) {
    tier = herPaper(it.o, r.id, ev) ? 'verbatim' : 'taught';
  } else if (ev && uncited) {
    tier = 'textbook';
    candidateEv = ev;
    why = `cites ${r.head}, which supports the wording but contains no figure of "${uncited}" — the number is not hers`;
  } else if (weak) {
    /* Kept, not discarded: a human can accept this evidence in one glance, whereas
       throwing it away would silently lose a citation that is probably sound. */
    tier = 'textbook';
    candidateEv = ev;
    why = ev.how === 'phrase-question-only'
      ? `her QUESTION is at ${ev.loc} of ${r.head}, but this card's ANSWER was not found in her model answers there — the stem is verified, the answer is not`
      : `the topic appears at ${ev.loc} of ${r.head}, but the specific claim was not located — candidate evidence recorded for review`;
  } else if (r && r.id && !ev) {
    tier = 'textbook';
    why = `cites ${r.head} but no phrase from this card appears in that source — the citation was never verified`;
  } else if (r && r.via === 'unresolved') {
    tier = 'unverified';
    why = `cites "${r.head}", which resolves to no registered source`;
  } else if (ev && ['student-peer', 'external'].includes(auth)) {
    tier = 'textbook';
    why = `only support is a ${auth} source, which may not back a taught claim`;
  } else {
    tier = 'textbook';
    why = 'no citation — standard textbook content written for the pack';
  }

  proposals.push({
    kind: it.kind, i: it.i, type: it.o.type ?? 'glossary',
    label: (it.o.q ?? it.o.term ?? '').slice(0, 78),
    oldSrc: src, resolved: r?.id ?? null, via: r?.via ?? 'none',
    tier, why: why ?? null,
    ev: (tier === 'taught' || tier === 'verbatim') ? [ev, ...extraEv] : null,
    candidateEv, quantityIssues: qIssues,
  });
}

fs.writeFileSync(path.join(HERE, 'migration.json'), JSON.stringify({ proposals }, null, 1));

const byTier = {};
for (const p of proposals) byTier[p.tier] = (byTier[p.tier] ?? 0) + 1;
const cited = proposals.filter(p => p.oldSrc).length;
const promoted = proposals.filter(p => p.tier === 'taught').length;
const hers = proposals.filter(p => p.tier === 'verbatim').length;
const failedCite = proposals.filter(p => p.oldSrc && !['taught', 'verbatim'].includes(p.tier)).length;
const qFix = proposals.filter(p => p.quantityIssues.length);

console.log('══ PHASE 4 · TRIAGE PROPOSAL ═══════════════════════');
console.log(`  ${proposals.length} items (${pack.cards.length} cards + ${pack.glossary.length} glossary)\n`);
console.log('  proposed tiers:');
for (const [t, n] of Object.entries(byTier).sort((a, b) => b[1] - a[1])) console.log(`    ${String(n).padStart(4)}  ${t}`);
console.log(`\n  ${cited} item(s) carry an old citation`);
console.log(`    ${promoted} promoted to \`taught\` — a phrase from the card was found verbatim in the cited source`);
console.log(`    ${hers} promoted to \`verbatim\` — the cited source is a paper SHE SET and the quote is her stem or her marking schedule`);
console.log(`    ${failedCite} could NOT be substantiated from what they cite`);
console.log(`\n  ${qFix.length} item(s) have a declared-quantity issue to rewrite:`);
const byIssue = {};
for (const p of qFix) for (const q of p.quantityIssues) byIssue[`${q.id} (${q.kind})`] = (byIssue[`${q.id} (${q.kind})`] ?? 0) + 1;
for (const [k, n] of Object.entries(byIssue).sort((a, b) => b[1] - a[1])) console.log(`    ${String(n).padStart(3)}×  ${k}`);
/* `ev` has been an ARRAY since extraEv was added; reading `.scope` off the array itself
   incremented scope[undefined] and printed a confident "0 · 0" for the whole pack. */
const scope = { cited: 0, document: 0 };
for (const p of proposals) if (p.ev?.[0]) scope[p.ev[0].scope]++;
console.log(`\n  evidence located at the cited slide/page: ${scope.cited} · elsewhere in the same document: ${scope.document}`);
console.log('\nwrote audit/migration.json  (proposal only — nothing has been applied)');
