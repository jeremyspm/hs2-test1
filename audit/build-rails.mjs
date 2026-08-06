/* THE RAIL — Giga's Progressive Reconstruction, ported onto this pack.
   Run: node audit/build-rails.mjs        (writes audit/rails.js)

   WHY THIS EXISTS. Every other card in the pack is a question with an answer: a string
   with a hole at the end. Giga's study loop works on a different object — a CHAIN of
   labelled relations, "Pump action of the heart —generates→ Hydrostatic pressure
   —is highest at the→ Arterial end of the capillary" — which is a STRUCTURE with holes
   in it. You cannot write one as a paragraph, so it cannot become the wall of text this
   rebuild is trying to get rid of, and rebuilding a run end to end tests the thing an
   exam actually asks for: not "what is oncotic pressure" but "what follows from what".

   WHERE THE RELATIONS COME FROM — and what that does and does not entitle them to.
   All 214 are copied from hs2-module1, the Module 1 study hub, which cites the lecture
   slides for its content ([[porting-not-reimplementing]] — copied, not re-derived, and
   the gate below proves the copy is exact). That hub is the pack's own cross-check for
   contested numbers, so this is the best-sourced material available that is not a
   question she set.

   It is still NOT her question, so a rail card is NOT `verbatim` and must never claim
   to be. It ships as its own tier, and — the part that matters — it is excluded from
   the coverage and `thin` counts. A rail is a different kind of study object; letting
   it fill a focus point would make a thin one look covered while the number of real
   questions under it had not moved. The thin list must keep meaning "how much of her
   material exists here".
*/
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const SIBLING = path.resolve(ROOT, '..', 'hs2-module1', 'index.html');
const KEEP_ORPHANS = process.argv.includes('--keep-orphans');

/* ── read the sibling's LINKS and ROUTES, by PARSING them ─────────────────────
   Not by regex. A first attempt used one and silently dropped 22 of the 214 relations
   — every triple containing an escaped apostrophe — and reported 192 as if that were
   the whole set. The only copy of this data is a shipped HTML file, so it gets read as
   code.

   BOTH tables are ported, and the second one is the point. A first attempt derived the
   routes here with a greedy path cover and produced 94 rails of which 53 were a single
   link — a technically valid cover that is useless to study. hs2-module1 does not
   derive its routes at all: they are AUTHORED and NAMED ("Filtration — the arterial
   end", "Blood flow through the heart"), which is both better grouping than an
   algorithm will find and a title the reader can recognise. Porting the algorithm's
   input while re-inventing its output is exactly the mistake [[porting-not-reimplementing]]
   is about. */
function readTable(name) {
  if (!fs.existsSync(SIBLING)) { console.error(`✗ hs2-module1/index.html not found at ${SIBLING}`); process.exit(1); }
  const s = fs.readFileSync(SIBLING, 'utf8');
  const i = s.indexOf(`const ${name}={`);
  if (i < 0) { console.error(`✗ ${name} not found in hs2-module1 — it has been renamed or removed`); process.exit(1); }
  let depth = 0, end = -1;
  for (let p = s.indexOf('{', i); p < s.length; p++) {
    const ch = s[p];
    if (ch === "'" || ch === '"') { const q = ch; p++; while (p < s.length && s[p] !== q) { if (s[p] === '\\') p++; p++; } continue; }
    if (ch === '{') depth++;
    else if (ch === '}') { depth--; if (depth === 0) { end = p; break; } }
  }
  if (end < 0) { console.error(`✗ unbalanced ${name} object`); process.exit(1); }
  const ctx = vm.createContext({});
  vm.runInContext(s.slice(i, end + 1) + `;\nglobalThis.__T__ = ${name};`, ctx);
  return ctx.__T__;
}

/* hs2-module1 groups Module 1 by lecture; this pack groups it by examinable area.
   One-to-one, checked against both topic lists by name. */
const TOPIC = {
  cvs1: 'cvs-vessels',  // Blood Vessels & Circulation
  cvs2: 'cvs-anat',     // The Heart & Blood Flow
  cvs3: 'cvs-ecg',      // Cardiac Physiology — conduction, ECG & output
  cvs4: 'cvs-bp',       // Regulation of Blood Pressure
  shock: 'cvs-output',  // Circulatory Shock
  resp1: 'resp-anat',   // Respiratory Anatomy
  resp2: 'resp-mech',   // Ventilation & External Respiration
  resp3: 'resp-gas',    // Gas Transport & Acid–Base
  resp4: 'resp-control',// Regulation of Breathing
  lymph: 'lymph',       // The Lymphatic System
};

const LINKS = readTable('LINKS');
const ROUTES = readTable('ROUTES');
const cards = [];
const stats = [];
const orphans = [];

for (const [tid, links] of Object.entries(LINKS)) {
  const topic = TOPIC[tid];
  if (!topic) { console.error(`✗ hs2-module1 topic "${tid}" has no mapping in TOPIC — the sibling has added a topic`); process.exit(1); }
  const routes = ROUTES[tid] ?? [];
  const used = new Set();
  let n = 0;

  for (const r of routes) {
    /* A route only means anything if consecutive relations actually JOIN — link[k].to
       must equal link[k+1].from. hs2-module1 splits a broken join at render time and
       warns; here it is a build failure, because a rail whose beads do not connect
       teaches a sequence that does not exist. */
    let run = [];
    const flush = () => { if (run.length) { cards.push(mk(topic, r.name, run, tid)); n++; } run = []; };
    for (const i of r.idx) {
      const l = links[i];
      if (!l) { console.error(`✗ ${tid} route "${r.name}" references link ${i}, which does not exist`); process.exit(1); }
      used.add(i);
      if (run.length && run[run.length - 1][2] !== l[0]) {
        console.error(`✗ ${tid} route "${r.name}" breaks: "${run[run.length - 1][2]}" does not lead to "${l[0]}"`);
        process.exit(1);
      }
      run.push(l);
    }
    flush();
  }

  /* Relations on no named route are NOT shipped, and this is the one real deviation
     from hs2-module1, which keeps them as one-link chains in Full mode.

     There are 60 of them and every one is a single link, so as a "rail" each is just a
     flashcard with an arrow in it — none of the reconstruction that makes a rail worth
     having. This pack has just had 331 cards culled for being volume rather than value;
     adding 60 trivial ones back would undo that. hs2-module1's own Core mode defers
     exactly these as "the loose detail", and a cram tool with a fixed date is Core by
     nature. Nothing is lost: they are still relations between concepts the 255
     question-cards already cover, and they are one flag away. */
  links.forEach((l, i) => { if (!used.has(i)) orphans.push(`${tid}: ${l[0]} → ${l[2]}`); });
  if (KEEP_ORPHANS) links.forEach((l, i) => { if (!used.has(i)) { cards.push(mk(topic, '', [l], tid)); n++; } });

  stats.push([tid, topic, links.length, routes.length, n, links.filter((_, i) => !used.has(i)).length]);
}

function mk(topic, name, run, from) {
  return {
    type: 'rail', topic, tier: 'rail', from,
    ...(name ? { name } : {}),
    beads: [run[0][0], ...run.map(l => l[2])],
    verbs: run.map(l => l[1]),
  };
}

/* ── the gate: prove the copy is exact ────────────────────────────────────────
   Every relation in the sibling must appear in exactly one rail, and no rail may
   contain a relation the sibling does not have. A path cover that quietly dropped or
   duplicated a link would be invisible in the shipped tool. */
const want = [];
for (const [tid, links] of Object.entries(LINKS)) {
  const onRoute = new Set();
  for (const r of ROUTES[tid] ?? []) for (const i of r.idx) onRoute.add(i);
  links.forEach((l, i) => { if (KEEP_ORPHANS || onRoute.has(i)) want.push(tid + '|' + l.join('|')); });
}
const got = [];
for (const c of cards) for (let i = 0; i < c.verbs.length; i++) got.push(c.from + '|' + c.beads[i] + '|' + c.verbs[i] + '|' + c.beads[i + 1]);
const wantS = [...want].sort(), gotS = [...got].sort();
const missing = wantS.filter(x => !gotS.includes(x));
const extra = gotS.filter(x => !wantS.includes(x));
const dupes = gotS.filter((x, i) => gotS[i - 1] === x);
if (missing.length || extra.length || dupes.length) {
  console.error();
  [...missing.slice(0, 3), ...extra.slice(0, 3), ...dupes.slice(0, 3)].forEach(x => console.error('   ' + x));
  process.exit(1);
}

const body = `/* GENERATED by audit/build-rails.mjs from hs2-module1's LINKS. Do not hand-edit.
   ${want.length} relations from the Module 1 study hub, arranged into ${cards.length} rails as an
   edge-disjoint path cover: every relation rides exactly one rail. See build-rails.mjs
   for why these are their own tier and why they do NOT count toward focus-point coverage. */
export const RAILS = ${JSON.stringify(cards, null, 1)};
`;
fs.writeFileSync(path.join(HERE, 'rails.js'), body);

console.log('══ RAILS ═══════════════════════════════════════════');
console.log('  sibling → pack topic     relations  named  rails  unnamed');
for (const [tid, topic, nl, nnamed, nr, norph] of stats) {
  console.log(`  ${tid.padEnd(6)} → ${topic.padEnd(13)} ${String(nl).padStart(4)}   ${String(nnamed).padStart(4)}   ${String(nr).padStart(4)}   ${String(norph).padStart(4)}`);
}
console.log(`\n  ${want.length} relations · ${cards.length} rails · every relation on exactly one rail ✓`);
const lens = cards.map(c => c.verbs.length).sort((a, b) => a - b);
const named = cards.filter(c => c.name);
console.log(`  rail length: median ${lens[Math.floor(lens.length / 2)]}, longest ${lens[lens.length - 1]}, ${lens.filter(x => x === 1).length} single-link`);
console.log(`  ${named.length} carry an authored name, ${cards.length - named.length} are unnamed leftovers`);
console.log(`  named-rail length: median ${(() => { const a = named.map(c => c.verbs.length).sort((x, y) => x - y); return a[Math.floor(a.length / 2)]; })()}`);
console.log('\n  wrote audit/rails.js');
