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

// quick authoring stats so a build always tells you where the pack stands
const types = {};
for (const m of pack.matchAll(/type:\s*'(\w+)'/g)) types[m[1]] = (types[m[1]] || 0) + 1;
const total = Object.values(types).reduce((x, y) => x + y, 0);
console.log(`built index.html — ${(out.length / 1024).toFixed(0)} KB`);
console.log(`${total} cards:`, Object.entries(types).map(([k, v]) => `${k} ${v}`).join(' · '));

// coverage: which declared criteria are still under their card floor
const declared = [...pack.matchAll(/\{\s*id:'([\w-]+)',\s*name:'[^']*'(,\s*blind:true)?\s*\}/g)]
  .map(m => ({ id: m[1], blind: !!m[2] }));
const counts = {};
for (const m of pack.matchAll(/crit:'([\w-]+)'/g)) counts[m[1]] = (counts[m[1]] || 0) + 1;
const MIN = 6, BLIND_MIN = 10;
const short = declared.filter(c => (counts[c.id] || 0) < (c.blind ? BLIND_MIN : MIN));
console.log(short.length
  ? `${short.length} criteria under floor: ` + short.map(c => `${c.id} ${counts[c.id] || 0}/${c.blind ? BLIND_MIN : MIN}`).join(' · ')
  : `all ${declared.length} criteria at or above their card floor ✓`);
console.log(`${used.size} of ${Object.keys(FIG).length} ported figures wired to cards`);
