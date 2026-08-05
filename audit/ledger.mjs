/* Phase 0 — freeze & measure.
   Produces audit/ledger.json + a console summary: one row per card and per glossary
   term, with quantities extracted, src strings parsed, and cross-card quantity
   conflicts detected. No corpus is consulted here — corpus-backed verification is
   Phase 1/4. This phase only establishes WHAT EXISTS. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { loadPack } from './load-pack.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const EXPORT = path.resolve(ROOT, '..', '_inbox', 'Health Science 2 Export Module 1');

/* The ledger measures the ORIGINAL hand-authored pack — that is the thing being audited. */
const { pack, src } = loadPack(path.join(ROOT, 'pack.source.js'));

/* ---------- freeze: record exactly what we are auditing ---------- */
const sha = (p) => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const freeze = {
  at: new Date().toISOString(),
  commit: (() => {
    try {
      const head = fs.readFileSync(path.join(ROOT, '.git', 'HEAD'), 'utf8').trim();
      const m = head.match(/^ref:\s*(.+)$/);           // HEAD is usually a ref, not a SHA
      if (!m) return head;
      const p = path.join(ROOT, '.git', m[1]);
      if (fs.existsSync(p)) return fs.readFileSync(p, 'utf8').trim();
      const packed = fs.readFileSync(path.join(ROOT, '.git', 'packed-refs'), 'utf8');
      return packed.split('\n').find(l => l.endsWith(' ' + m[1]))?.split(' ')[0] ?? null;
    } catch { return null; }
  })(),
  files: Object.fromEntries(['pack.js', 'index.html', 'figs.js', 'build.mjs']
    .filter(f => fs.existsSync(path.join(ROOT, f)))
    .map(f => [f, { bytes: fs.statSync(path.join(ROOT, f)).size, sha256: sha(path.join(ROOT, f)) }])),
};

/* ---------- the export's real file list, for src resolution ---------- */
const exportFiles = [];
(function walk(d) {
  if (!fs.existsSync(d)) return;
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p); else exportFiles.push(path.relative(EXPORT, p));
  }
})(EXPORT);

/* ---------- text harvesting ---------- */
/* Every string a card can put in front of the user. Missing one here means a claim
   escapes the audit, so this walks the object rather than naming fields. */
function strings(v, out = []) {
  if (typeof v === 'string') out.push(v);
  else if (Array.isArray(v)) v.forEach(x => strings(x, out));
  else if (v && typeof v === 'object') Object.entries(v).forEach(([k, x]) => { if (k !== 'src') strings(x, out); });
  return out;
}
const textOf = (o) => strings(o).join(' ⏎ ');

/* ---------- quantities ---------- */
const UNIT = String.raw`%|mmHg|mm\s?Hg|mL|ml|L\/min|litres|µm|um|m²|\/min|bpm|kPa|mEq|mm|cm|°C`;
const QRE = new RegExp(String.raw`(?<![\w.\-])(\d+(?:[.,]\d+)?)\s*(${UNIT})(?![\w])`, 'g');
function quantities(t) {
  const out = [];
  for (const m of t.matchAll(QRE)) {
    out.push({ value: m[1].replace(',', '.'), unit: m[2].replace(/\s+/g, ''), raw: m[0].trim() });
  }
  return out;
}

/* ---------- src parsing ---------- */
function parseSrc(s) {
  if (!s) return null;
  const head = s.split(/\s+slides?\s|\s—\s|,\s/)[0].trim();
  const needle = head.toLowerCase().replace(/\s+/g, ' ');
  const matches = exportFiles.filter(f => {
    const base = path.basename(f, path.extname(f)).toLowerCase().replace(/\s+/g, ' ');
    return base.includes(needle) || needle.includes(base);
  });
  return { raw: s, head, resolved: matches.length > 0, candidates: matches.slice(0, 3) };
}

/* ---------- build rows ---------- */
const rows = [];
pack.cards.forEach((c, i) => {
  const t = textOf(c);
  rows.push({
    kind: 'card', idx: i, type: c.type, topic: c.topic, crit: c.crit,
    lean: c.lean ?? null, hasFig: /@@FIG:/.test(JSON.stringify(c)),
    src: c.src ?? null, srcInfo: parseSrc(c.src),
    quantities: quantities(t), chars: t.length,
    label: (c.q ?? c.term ?? '').slice(0, 90),
  });
});
pack.glossary.forEach((g, i) => {
  const t = textOf(g);
  rows.push({
    kind: 'glossary', idx: i, type: 'glossary', topic: null, crit: null,
    src: g.src ?? null, srcInfo: parseSrc(g.src),
    quantities: quantities(t), chars: t.length, label: (g.term ?? '').slice(0, 90),
  });
});

/* ---------- quantity index ----------
   Phase 0 reports WHAT EXISTS and nothing more. An earlier draft of this file tried to
   infer concepts from prose ("this number is near the word atmospheric, so it is an
   atmospheric partial pressure") and it was wrong in both directions: it tagged
   nitrogen's 592.8 as an oxygen value, and it flagged "0.5–1 µm" — a correct range
   copied from her slides — as a self-contradiction. An inferring checker that is wrong
   in both directions is worse than no checker, because it manufactures confidence.

   So: this emits a plain index of every distinct value+unit and the items carrying it.
   The canonical-value table (spec §5 G5) is DECLARED by hand in Phase 2 against the
   corpus, and the conflict check becomes a lookup rather than a guess. The index below
   is the worklist that table is written from. */
const index = {};
for (const r of rows) {
  for (const q of r.quantities) {
    const k = `${q.value}${q.unit}`;
    (index[k] ??= []).push({ kind: r.kind, idx: r.idx, label: r.label, src: r.src });
  }
}

/* Items where a unit-bearing quantity co-occurs with bare decimals — the signature of
   a list whose unit is stated once and then implied ("760 mmHg … PN₂ 592.8, PO₂ 159.6").
   Those bare values escape the unit-anchored index above, so they are named here rather
   than left to look like they do not exist. */
const impliedSuspects = rows
  .filter(r => r.quantities.length)
  .map(r => {
    const full = r.kind === 'card' ? textOf(pack.cards[r.idx]) : textOf(pack.glossary[r.idx]);
    const bare = [...full.matchAll(/(?<![\w.\-])(\d+\.\d+)(?!\s*(?:%|mmHg|mm\s?Hg|mL|ml|µm|um|kPa|cm|mm))/g)].map(m => m[1]);
    return bare.length ? { kind: r.kind, idx: r.idx, label: r.label, bare: [...new Set(bare)] } : null;
  })
  .filter(Boolean);

/* ---------- write + report ---------- */
const out = { freeze, counts: {}, rows, quantityIndex: index, impliedUnitSuspects: impliedSuspects };
const nCards = rows.filter(r => r.kind === 'card').length;
const nGloss = rows.filter(r => r.kind === 'glossary').length;
const withSrc = rows.filter(r => r.src).length;
const unresolved = rows.filter(r => r.src && !r.srcInfo.resolved);
const allQ = rows.flatMap(r => r.quantities);
out.counts = {
  cards: nCards, glossary: nGloss, withSrc, withoutSrc: rows.length - withSrc,
  srcUnresolved: unresolved.length, quantityMentions: allQ.length,
  itemsWithQuantity: rows.filter(r => r.quantities.length).length,
};
fs.writeFileSync(path.join(HERE, 'ledger.json'), JSON.stringify(out, null, 1));

const byType = {};
for (const r of rows.filter(r => r.kind === 'card')) byType[r.type] = (byType[r.type] ?? 0) + 1;

console.log('── FREEZE ─────────────────────────────────────────');
console.log('  commit  ', freeze.commit);
for (const [f, v] of Object.entries(freeze.files)) console.log(`  ${f.padEnd(11)} ${String(v.bytes).padStart(8)} B  ${v.sha256.slice(0, 16)}…`);
console.log('\n── INVENTORY ──────────────────────────────────────');
console.log(`  cards ${nCards} · glossary ${nGloss} · criteria ${pack.criteria.length} · topics ${pack.topics.length}`);
console.log('  card types:', Object.entries(byType).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(' · '));
console.log('\n── PROVENANCE ─────────────────────────────────────');
console.log(`  with src        ${withSrc} / ${rows.length}  (${Math.round(100 * withSrc / rows.length)}%)`);
console.log(`  src unresolved  ${unresolved.length}`);
const byHead = {};
for (const r of unresolved) byHead[r.srcInfo.head] = (byHead[r.srcInfo.head] ?? 0) + 1;
for (const [h, n] of Object.entries(byHead).sort((a, b) => b[1] - a[1])) console.log(`     ${String(n).padStart(3)}×  ${h}`);
console.log('\n── QUANTITIES ─────────────────────────────────────');
console.log(`  ${allQ.length} mentions across ${out.counts.itemsWithQuantity} items`);
console.log(`  ⚠ unit-anchored: a number whose unit is implied by an earlier one in the`);
console.log(`    same sentence is NOT counted here. Card #53 writes "PO₂ 159.6" with the`);
console.log(`    unit carried by "760 mmHg" before it, so 159.6 is absent from this index.`);
console.log(`    ${impliedSuspects.length} item(s) show that pattern and are listed in ledger.json`);
console.log(`    as impliedUnitSuspects. Phase 2 searches declared values unit-agnostically.`);
console.log('\n── QUANTITY INDEX (worklist for the Phase 2 canonical table) ──');
const idx = Object.entries(index).sort((a, b) => b[1].length - a[1].length);
console.log(`  ${idx.length} distinct value+unit pairs across ${allQ.length} mentions`);
for (const [k, hits] of idx.slice(0, 12)) {
  const cited = hits.filter(h => h.src).length;
  console.log(`  ${k.padEnd(10)} ${String(hits.length).padStart(2)}×${cited ? `  (${cited} on a cited card)` : ''}`);
}
console.log('  … full index in ledger.json');
console.log('\nwrote audit/ledger.json');
