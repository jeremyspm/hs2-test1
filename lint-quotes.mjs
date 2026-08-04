/* Finds apostrophes that would terminate a single-quoted card string early.
   A stray one silently kills the whole app: the page renders, no JS runs.
   Run: node lint-quotes.mjs */
import { readFileSync } from 'node:fs';

const BACKSLASH = String.fromCharCode(92);
const lines = readFileSync('pack.js', 'utf8').split('\n');
const bad = [];

for (const [n, line] of lines.entries()) {
  // walk the line tracking whether we are inside a single-quoted string
  let inStr = false, inTick = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i], prev = i ? line[i - 1] : '';
    if (prev === BACKSLASH) continue;
    if (ch === '`') inTick = !inTick;
    if (inTick) continue;
    if (ch !== "'") continue;
    if (!inStr) { inStr = true; continue; }
    // closing quote candidate — legal only before , ) ] } : or end of line
    const next = (line.slice(i + 1).match(/^\s*(.)/) || [])[1] || '';
    if (next === '' || ',)]}:'.includes(next)) { inStr = false; continue; }
    bad.push({ n: n + 1, col: i + 1, line: line.trim().slice(0, 150) });
    inStr = false;
  }
}

if (!bad.length) { console.log('✓ no stray apostrophes in pack.js'); process.exit(0); }
console.error(`✗ ${bad.length} stray apostrophe(s) — escape them as ${BACKSLASH}':`);
for (const b of bad) console.error(`  line ${b.n} col ${b.col}: ${b.line}`);
process.exit(1);
