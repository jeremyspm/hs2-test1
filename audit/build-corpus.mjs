/* Phase 1a — source registry + corpus.
   Every extractable unit of her material, addressable as (src, loc), with the source
   file pinned by sha256 so silent drift fails the build rather than passing quietly.

   Extraction only. Nothing here summarises, paraphrases, or interprets. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
/* Two roots. The 2026 export is the current, authoritative material. The legacy
   archive (restored 5 Aug 2026) holds the 30-question `MODULE 1 : Formative Test` that
   20 cards cite and that is absent from the new export — its QUESTIONS are hers and
   verifiable, though it was printed from a blank attempt so it carries no answer key. */
const ROOTS = [
  path.resolve(ROOT, '..', '_inbox', 'Health Science 2 Export Module 1'),
  path.resolve(ROOT, '..', '_inbox', 'HEALTH SCIENCE 2'),
];
const EXPORT = ROOTS[0];

/* ── minimal zip reader (pptx/docx are zips; avoids a dependency) ───────────── */
function unzip(file) {
  const buf = fs.readFileSync(file);
  // locate End Of Central Directory
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0 && i > buf.length - 66000; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('not a zip: ' + file);
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const out = new Map();
  for (let i = 0; i < count; i++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) break;
    const method = buf.readUInt16LE(p + 10);
    const compSize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const cmtLen = buf.readUInt16LE(p + 32);
    const lho = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen);
    const lnLen = buf.readUInt16LE(lho + 26);
    const leLen = buf.readUInt16LE(lho + 28);
    const start = lho + 30 + lnLen + leLen;
    const raw = buf.subarray(start, start + compSize);
    out.set(name, method === 0 ? raw : zlib.inflateRawSync(raw));
    p += 46 + nameLen + extraLen + cmtLen;
  }
  return out;
}

const decode = (b) => b.toString('utf8');
const unesc = (s) => s
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
  .replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
  .replace(/&amp;/g, '&');
const tidy = (s) => unesc(s).replace(/\s+/g, ' ').trim();

/* ── per-format extractors ─────────────────────────────────────────────────── */
function fromPptx(file) {
  const z = unzip(file);
  const names = [...z.keys()].filter(n => /^ppt\/slides\/slide\d+\.xml$/.test(n))
    .sort((a, b) => +a.match(/(\d+)/)[1] - +b.match(/(\d+)/)[1]);
  const units = [];
  for (const n of names) {
    const i = +n.match(/(\d+)/)[1];
    const xml = decode(z.get(n));
    const t = tidy([...xml.matchAll(/<a:t>(.*?)<\/a:t>/gs)].map(m => m[1]).join(' | '));
    // bold runs, used by the model-answer key extractor
    const bold = [...xml.matchAll(/<a:r>(.*?)<\/a:r>/gs)]
      .filter(m => /<a:rPr[^>]*\bb="1"/.test(m[1]))
      .map(m => tidy([...m[1].matchAll(/<a:t>(.*?)<\/a:t>/gs)].map(x => x[1]).join('')))
      .filter(Boolean);
    if (t) units.push({ loc: `slide ${i}`, t, ...(bold.length ? { bold } : {}) });
  }
  return units;
}

function fromDocx(file) {
  const z = unzip(file);
  const xml = decode(z.get('word/document.xml'));
  const paras = xml.replace(/<w:tab[^>]*\/>/g, '\t').split(/<\/w:p>/);
  const units = [];
  paras.forEach((p, i) => {
    const t = tidy(p.replace(/<[^>]+>/g, ''));
    if (t) units.push({ loc: `para ${i + 1}`, t });
  });
  return units;
}

function fromTxt(file) {
  return fs.readFileSync(file, 'utf8').split(/\r?\n/)
    .map((l, i) => ({ loc: `line ${i + 1}`, t: tidy(l) }))
    .filter(u => u.t);
}

/* ── walk the export ───────────────────────────────────────────────────────── */
const registry = {};
const corpus = [];
const skipped = [];
const duplicates = [];

const files = [];
for (const root of ROOTS) {
  if (!fs.existsSync(root)) { skipped.push({ file: root, why: 'root not present' }); continue; }
  (function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p); else files.push(p);
    }
  })(root);
}
const relTo = (f) => {
  const root = ROOTS.find(r => f.startsWith(r));
  return path.relative(root ?? EXPORT, f);
};

const sha = (p) => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');

/* Stable source IDs, derived from the filename so they survive folder moves.
   Collisions (the same deck filed in two folders) are resolved by keeping the first
   and recording the duplicate, rather than silently minting two IDs for one document. */
function makeId(file) {
  const base = path.basename(file, path.extname(file));
  return 'SRC-' + base.toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 46);
}


for (const f of files.sort()) {
  const ext = path.extname(f).toLowerCase();
  let units = null;
  try {
    if (ext === '.pptx') units = fromPptx(f);
    else if (ext === '.docx') units = fromDocx(f);
    else if (ext === '.txt') units = fromTxt(f);
    // PDFs are handled by the Python sidecar below, which is the sole authority on
    // their outcome — reporting them here too would list an extracted file as a gap.
    else if (ext === '.pdf') continue;
    else { skipped.push({ file: relTo(f), why: 'unsupported format ' + (ext || '(none)') }); continue; }
  } catch (e) {
    skipped.push({ file: relTo(f), why: 'extract failed: ' + e.message });
    continue;
  }
  if (!units.length) {
    skipped.push({ file: relTo(f), why: 'no extractable text (image-only?)' });
    continue;
  }
  const id0 = makeId(f);
  let id = id0;
  const digest = sha(f);
  const existing = Object.entries(registry).find(([, v]) => v.sha256 === digest);
  if (existing) { duplicates.push({ file: relTo(f), sameAs: existing[0] }); continue; }
  for (let n = 2; registry[id]; n++) id = `${id0}-${n}`;

  registry[id] = {
    path: path.relative(path.resolve(ROOT, '..'), f).replace(/\\/g, '/'),
    sha256: digest,
    kind: ext.slice(1),
    label: path.basename(f, ext),
    units: units.length,
    authority: /SAQ PRACTICE DISCUSSIONS|DISCUSSION_/i.test(f) ? 'student-peer'
             : /ESSENTIAL DOCUMENTS|SUMMATIVE ASSESSMENTS/i.test(f) ? 'course-doc'
             : 'lecturer',
  };
  for (const u of units) corpus.push({ src: id, ...u });
}

/* ── merge the PDF sidecar (audit/extract-pdfs.py) ─────────────────────────── */
const pdfSidecar = path.join(HERE, 'pdf-units.json');
if (fs.existsSync(pdfSidecar)) {
  const { units, empty } = JSON.parse(fs.readFileSync(pdfSidecar, 'utf8'));
  const byFile = new Map();
  for (const u of units) (byFile.get(u.file) ?? byFile.set(u.file, []).get(u.file)).push(u);
  for (const [rel, us] of byFile) {
    const abs = path.resolve(ROOT, '..', rel);
    if (!fs.existsSync(abs)) { skipped.push({ file: rel, why: 'sidecar references a missing file' }); continue; }
    const digest = sha(abs);
    const dupe = Object.entries(registry).find(([, v]) => v.sha256 === digest);
    if (dupe) { duplicates.push({ file: rel, sameAs: dupe[0] }); continue; }
    const id0 = makeId(abs);
    let id = id0;
    for (let n = 2; registry[id]; n++) id = `${id0}-${n}`;
    registry[id] = {
      path: rel, sha256: digest, kind: 'pdf',
      label: path.basename(rel, '.pdf'), units: us.length,
      authority: /ESSENTIAL DOCUMENTS|SUMMATIVE ASSESSMENTS/i.test(rel) ? 'course-doc' : 'lecturer',
    };
    for (const u of us) corpus.push({ src: id, loc: u.loc, t: u.t });
  }
  for (const e of empty) skipped.push({ file: e.file, why: e.why });
} else {
  skipped.push({ file: '(all PDFs)', why: 'sidecar not built — run: python audit/extract-pdfs.py' });
}

fs.writeFileSync(path.join(HERE, 'registry.json'), JSON.stringify(registry, null, 1));
fs.writeFileSync(path.join(HERE, 'corpus.json'), JSON.stringify(corpus));
fs.writeFileSync(path.join(HERE, 'corpus-skipped.json'), JSON.stringify({ skipped, duplicates }, null, 1));

const byKind = {};
for (const v of Object.values(registry)) byKind[v.kind] = (byKind[v.kind] ?? 0) + 1;
const byAuth = {};
for (const v of Object.values(registry)) byAuth[v.authority] = (byAuth[v.authority] ?? 0) + 1;

console.log('── SOURCE REGISTRY ────────────────────────────────');
console.log(`  ${Object.keys(registry).length} sources  ·  ${Object.entries(byKind).map(([k, v]) => `${k} ${v}`).join(' · ')}`);
console.log(`  authority: ${Object.entries(byAuth).map(([k, v]) => `${k} ${v}`).join(' · ')}`);
console.log(`  ${duplicates.length} duplicate file(s) collapsed by sha256`);
console.log('── CORPUS ─────────────────────────────────────────');
console.log(`  ${corpus.length} addressable units  ·  ${corpus.reduce((n, u) => n + u.t.length, 0).toLocaleString()} chars`);
console.log(`  units with bold runs (answer-key candidates): ${corpus.filter(u => u.bold).length}`);
console.log('── NOT EXTRACTED ──────────────────────────────────');
/* Images and the quiz captures are skipped by design (captures are parsed by
   parse-quizzes.mjs). Everything else that failed to yield text is named in full:
   a content file that silently contributes nothing is indistinguishable from one
   that was covered, which is the failure this whole audit exists to prevent. */
const byDesign = skipped.filter(s => /unsupported format \.(jpe?g|png|gif|html?|mp4|pkl)$/i.test(s.why));
const gaps = skipped.filter(s => !byDesign.includes(s));
console.log(`  ${byDesign.length} images / quiz captures / video — skipped by design`);
console.log(`  ${gaps.length} content file(s) yielded NO text — these are real gaps:`);
for (const s of gaps) console.log(`     ! ${s.file.split(/[\\/]/).pop()}  — ${s.why}`);
console.log('\nwrote audit/registry.json, corpus.json, corpus-skipped.json');
