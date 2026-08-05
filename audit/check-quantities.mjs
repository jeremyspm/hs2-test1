/* Verify quantities.json against the corpus BEFORE anything is built on it.
   Every declared quote must appear verbatim at its cited (src, loc). A canonical value
   table that is itself unverified would just move the trust problem one file along. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const corpus = JSON.parse(fs.readFileSync(path.join(HERE, 'corpus.json'), 'utf8'));
const registry = JSON.parse(fs.readFileSync(path.join(HERE, 'registry.json'), 'utf8'));
const table = JSON.parse(fs.readFileSync(path.join(HERE, 'quantities.json'), 'utf8'));

/* Normalisation is deliberately minimal — whitespace and dash variants only. Anything
   looser and the check quietly stops checking. */
export const normQuote = (s) => s
  .replace(/[‐-―−]/g, '-')
  .replace(/ /g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

export function quoteAt(src, loc, quote) {
  const unit = corpus.find(u => u.src === src && u.loc === loc);
  if (!unit) return { ok: false, why: `no such location (${src} ${loc})` };
  if (!normQuote(unit.t).includes(normQuote(quote))) {
    return { ok: false, why: 'quote not present at that location', found: unit.t.slice(0, 160) };
  }
  return { ok: true };
}

let fail = 0;
const checks = [];
for (const [id, q] of Object.entries(table)) {
  if (id.startsWith('_')) continue;
  if (q.notTaught) { checks.push([id, 'notTaught', null]); continue; }
  const evs = [['canonical', q.ev], ...(q.alsoTaught ?? []).map((a, i) => [`alsoTaught[${i}] ${a.value}`, a.ev])];
  for (const [label, ev] of evs) {
    if (!ev) { console.log(`✗ ${id} · ${label}: no evidence block`); fail++; continue; }
    if (!registry[ev.src]) { console.log(`✗ ${id} · ${label}: unknown source "${ev.src}"`); fail++; continue; }
    const r = quoteAt(ev.src, ev.loc, ev.quote);
    if (!r.ok) {
      console.log(`✗ ${id} · ${label}: ${r.why}`);
      console.log(`    wanted : ${JSON.stringify(ev.quote)}`);
      if (r.found) console.log(`    at loc : ${JSON.stringify(r.found)}`);
      fail++;
    } else checks.push([id, label, ev]);
  }
  /* Any rule that fires against pack text needs an explicit, hand-declared context
     regex. Without one the rule would match a bare number anywhere in the pack, which
     is the inference failure this table exists to avoid. */
  const hasRule = q.rejected?.length || q.needsHers?.length || q.mustContainRange;
  if (hasRule && !q.match) {
    console.log(`✗ ${id}: declares a rule (rejected/needsHers/mustContainRange) but no \`match\` context regex`);
    fail++;
  }
  if (q.match) {
    try { new RegExp(q.match, 'i'); }
    catch (e) { console.log(`✗ ${id}: \`match\` is not a valid regex — ${e.message}`); fail++; }
  }

  /* A canonical value must actually appear inside its own quote, or the quote is
     evidence for something else. */
  if (q.ev && q.canonical) {
    const nums = String(q.canonical).split('-');
    const missing = nums.filter(n => !normQuote(q.ev.quote).includes(n));
    if (missing.length) {
      console.log(`✗ ${id}: canonical "${q.canonical}" — ${missing.join(', ')} not found inside its own quote`);
      fail++;
    }
  }
}

for (const [id, label] of checks) console.log(`✓ ${id}${label === 'canonical' ? '' : ' · ' + label}`);
const declared = Object.keys(table).filter(k => !k.startsWith('_')).length;
console.log(`\n${declared} quantities declared · ${checks.length} evidence block(s) verified · ${fail} FAILED`);
if (fail) process.exit(1);
