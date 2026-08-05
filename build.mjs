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
writeFileSync('index.html', out);

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

// coverage: which declared criteria are still under their card floor
const counts = {};
for (const c of P.cards) for (const id of [c.crit, ...(c.alsoCrit ?? [])].filter(Boolean)) counts[id] = (counts[id] || 0) + 1;
const MIN = 6, BLIND_MIN = 10;
const short = (P.criteria ?? []).filter(c => (counts[c.id] || 0) < (c.blind ? BLIND_MIN : MIN));
console.log(short.length
  ? `${short.length} criteria under floor: ` + short.map(c => `${c.id} ${counts[c.id] || 0}/${c.blind ? BLIND_MIN : MIN}`).join(' · ')
  : `all ${(P.criteria ?? []).length} criteria at or above their card floor ✓`);
console.log(`${used.size} of ${Object.keys(FIG).length} ported figures wired to cards`);
if (used.size === 0) { console.error('✗ no figures wired — pack.js has lost its F()/FC() calls'); process.exit(1); }
