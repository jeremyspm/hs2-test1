/* Splices pack.js into cram-engine/template.html to produce the shipped
   single-file index.html. Run: node build.mjs
   The output is 100% offline and dependency-free — this build step exists
   only so the ~500-card pack stays editable in its own file. */
import { readFileSync, writeFileSync } from 'node:fs';

const TPL = '../cram-engine/template.html';
const START = '/* ===== CONTENT PACK START ===== */';
const END   = '/* ===== CONTENT PACK END ===== */';

const tpl  = readFileSync(TPL, 'utf8');
const pack = readFileSync('pack.js', 'utf8').replace(/^﻿/, '');

const a = tpl.indexOf(START), b = tpl.indexOf(END);
if (a < 0 || b < 0) { console.error('markers not found in template'); process.exit(1); }

// Figures live in the generated figs.js (ported byte-for-byte from
// hs2-module1). Inline them ahead of PACK so cards can call F('id')/FC('id').
const { FIG } = await import('./figs.js');
const used = new Set([...pack.matchAll(/\bFC?\('([a-z0-9-]+)'\)/g)].map(m => m[1]));
for (const id of used) if (!FIG[id]) { console.error(`pack references unknown figure "${id}"`); process.exit(1); }
const figBlock =
  'const FIGART={' + [...used].map(id => `'${id}':${JSON.stringify(FIG[id].art)}`).join(',\n') + '};\n' +
  'const FIGCAP={' + [...used].map(id => `'${id}':${JSON.stringify(FIG[id].cap)}`).join(',') + '};\n' +
  'const F=id=>FIGART[id]||\'\', FC=id=>FIGCAP[id]||\'\';\n';

const out = tpl.slice(0, a + START.length) + '\n' + figBlock + pack.trim() + '\n' + tpl.slice(b);

// Parse the generated page's scripts before writing. A stray apostrophe inside a
// single-quoted card string kills the whole app silently — the page still renders,
// it just runs no JavaScript. Never ship without this passing.
for (const [i, m] of [...out.matchAll(/<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/g)].entries()) {
  try { new Function(m[1]); }
  catch (e) {
    const line = (m[1].slice(0, Number(String(e.lineNumber ?? 0)) || 0).match(/\n/g) || []).length;
    console.error(`✗ script block ${i} does not parse: ${e.message}`);
    const bad = m[1].split('\n').find(l => /model:'|a:'|q:'|why:'/.test(l) && /[^\\]'[a-z]/.test(l.replace(/^\s*\w+:'/, '')));
    if (bad) console.error('  likely culprit (unescaped apostrophe):\n  ' + bad.trim().slice(0, 160));
    process.exit(1);
  }
}
/* Stats come from LOADING the pack, not from regexing it. pack.js is now generated
   JSON, so patterns written for the old hand-authored style (type:'flash', crit:'cvs-7')
   matched nothing and every count silently read zero — a build that reported "0 cards"
   while shipping 588. */
const { loadPack } = await import('./audit/load-pack.mjs');
const { pack: P } = loadPack();

const types = {};
for (const c of P.cards) types[c.type] = (types[c.type] || 0) + 1;
const tiers = {};
for (const c of P.cards) tiers[c.tier ?? '(none)'] = (tiers[c.tier ?? '(none)'] || 0) + 1;
console.log(`built index.html — ${(out.length / 1024).toFixed(0)} KB`);
console.log(`${P.cards.length} cards:`, Object.entries(types).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(' · '));
console.log('tiers:', Object.entries(tiers).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(' · '));

/* ── coverage gate ────────────────────────────────────────────────────────────
   This used to print its findings and ship anyway, and the engine rendered the same
   failures into the live page as a yellow banner — so a student's first sight of the
   tool was a build-time lint result written in authoring vocabulary, telling them the
   thing was broken before they had read a card.

   The banner is gone from the student build. That only works if the failure is caught
   HERE instead, so this now exits non-zero. The rule matches the engine's
   `validateCoverage` exactly, including counting `alsoCrit`: a build that passes must
   mean a page with nothing to complain about. Open the page with `?dev=1` to see the
   same list at runtime. */
const counts = {};
for (const c of P.cards) for (const id of [c.crit, ...(c.alsoCrit ?? [])].filter(Boolean)) counts[id] = (counts[id] || 0) + 1;
const { min: MIN = 6, blindMin: BLIND_MIN = 10, blindNeedsSaq = false } = P.coverage ?? {};
const covErrs = [];
for (const c of P.criteria ?? []) {
  const floor = c.blind ? Math.max(MIN, BLIND_MIN) : MIN;
  const n = counts[c.id] || 0;
  if (n < floor) covErrs.push(`${c.id} has ${n} cards, needs ${floor}`);
  if (c.blind && blindNeedsSaq && !P.cards.some(x => (x.crit === c.id || (x.alsoCrit ?? []).includes(c.id)) && x.type === 'saq'))
    covErrs.push(`${c.id} is never practised anywhere in the course and has no written-answer card`);
}
console.log(covErrs.length
  ? `✗ ${covErrs.length} coverage failure(s): ` + covErrs.join(' · ')
  : `all ${(P.criteria ?? []).length} focus points at or above their card floor ✓`);
if (covErrs.length) { console.error('\n✗ NOT SHIPPING. Fix the coverage above — the page no longer warns the reader on your behalf.'); process.exit(1); }
console.log(`${used.size} of ${Object.keys(FIG).length} ported figures wired to cards`);
if (used.size === 0) { console.error('✗ no figures wired — pack.js has lost its F()/FC() calls'); process.exit(1); }

/* ── explanation gate ─────────────────────────────────────────────────────────
   Getting a question wrong is the moment the tool either teaches the reader or loses
   them. A card that answers "why was I wrong?" with nothing but a red box does the
   second, and half the machine-marked cards used to do exactly that.

   The engine synthesises a floor line (the correct option, the pairs or blanks missed)
   so nobody ever meets a bare mark — but a floor is not teaching, and without a gate
   here there is nothing to stop the next batch of cards arriving without one. Same
   shape as the coverage gate above: authored in audit/explanations.json, enforced at
   ship time, no runtime warning for the reader to decode. */
const MARKED = ['mcq', 'match', 'cloze', 'tfset', 'order'];
const noWhy = P.cards.filter(c => MARKED.includes(c.type) && !String(c.why ?? '').trim());
const noModel = P.cards.filter(c => c.type === 'saq' && !String(c.model ?? '').trim());
console.log(noWhy.length || noModel.length
  ? `✗ ${noWhy.length} machine-marked card(s) with no explanation, ${noModel.length} written answer(s) with no model`
  : `every one of the ${P.cards.filter(c => MARKED.includes(c.type)).length} machine-marked cards explains itself, and all ${P.cards.filter(c => c.type === 'saq').length} written answers carry a model ✓`);
for (const c of [...noWhy, ...noModel].slice(0, 8)) {
  console.error(`    ${c.type} ${c.crit ?? '?'}: ${String(c.q ?? '').replace(/<[^>]+>/g, '').slice(0, 72)}`);
}
if (noWhy.length || noModel.length) {
  console.error('\n✗ NOT SHIPPING. Author the missing `why:`/`model:` in audit/explanations.json and re-run apply-migration.');
  process.exit(1);
}

/* Written last, so "NOT SHIPPING" above is literally true. It used to be written
   before the gates ran, which left a failing build with a fresh index.html on disk
   next to a message saying it had not shipped one. */
writeFileSync('index.html', out);
console.log('wrote index.html');
