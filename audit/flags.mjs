/* Turns a flags export from the live tool into a work list against pack.js.
   Run:  node audit/flags.mjs [path-to-flags.json]     (default audit/flags.json)

   The tool has no server. A reader who spots a wrong answer key hits ⚑ Flag, the
   flag lands in localStorage keyed by the card's `ckey`, and All cards → Flagged
   copies or downloads the lot as JSON. This is the other end of that: it resolves
   each flag back to the card it points at and prints the question, the answer and
   the explanation, so a flag can be acted on without hunting through 586 cards.

   WHY ckey AND NOT AN INDEX. `ckey` is hash(type | question | content signature) —
   the same key the dedupe, the progress records and explanations.json use. Editing
   the card changes it. So a flag against a card that has since been rewritten stops
   resolving, and that is the useful behaviour, not a bug: it is the file telling you
   the thing was probably already fixed. Those are listed separately with the
   question as it read when it was flagged, never silently dropped and never
   re-attached to whatever card now happens to be nearby.

   The hash is copied verbatim from apply-migration.mjs (step 7, `dedupe`), which is
   itself a copy of the engine's. Four lines duplicated across three places is a
   drift risk, so this script PROVES its copy still agrees with the one that built
   the pack before it trusts a single result — see checkKeyImpl below. */
import { readFileSync, existsSync } from 'node:fs';
import { loadPack } from './load-pack.mjs';

const strip = (s) => String(s).replace(/<[^>]+>/g, '');
const hash = (s) => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return 'k' + (h >>> 0).toString(36); };
const csig = (c) => strip([c.a, c.text, (c.options ?? []).join('~'), (c.statements ?? []).map(s => s.s).join('~'),
  (c.pairs ?? []).map(p => p.join('>')).join('~'), (c.steps ?? []).join('~'), (c.points ?? []).join('~')]
  .filter(Boolean).join('|'));
const ckey = (c) => hash(c.type + '|' + strip(c.q) + '|' + csig(c));

const { pack } = loadPack();
const byKey = new Map(pack.cards.map(c => [ckey(c), c]));

/* Does this file's ckey still agree with the one that built the pack? If it ever stops
   agreeing, EVERY flag reports as stale and the honest-looking output below is entirely
   wrong — the one failure mode worth spending ten lines to make impossible.

   THE FIXTURE IS audit/ckey-fixture.json, written by apply-migration.mjs: the key of
   every card that shipped, computed by the implementation that shipped it. Compared
   position by position against the same cards read back out of pack.js.

   It used to use explanations.json instead, on the reasoning that the build refuses to
   ship unless every entry attaches, so they were a free fixture. They are not. Those
   keys are computed BEFORE applyStems rewrites 28 of the questions and BEFORE the cull
   drops the cards they were written for, so 49 of 178 could never resolve against the
   shipped pack — and this script exited on that before printing a single flag. The hash
   was fine the whole time; the fixture was measuring the wrong thing. */
function checkKeyImpl() {
  const p = 'audit/ckey-fixture.json';
  if (!existsSync(p)) {
    console.error('✗ no audit/ckey-fixture.json — run: node audit/apply-migration.mjs --write');
    process.exit(1);
  }
  const fx = JSON.parse(readFileSync(p, 'utf8'));
  if (fx.cards !== pack.cards.length) {
    console.error(`✗ the fixture was built from a ${fx.cards}-card pack and pack.js has ${pack.cards.length} — regenerate it before trusting anything below.`);
    process.exit(1);
  }
  const mine = pack.cards.map(ckey);
  const miss = mine.filter((k, i) => k !== fx.keys[i]);
  if (miss.length) {
    console.error(`✗ ckey mismatch: ${miss.length} of ${mine.length} shipped cards hash differently here than they did in apply-migration.mjs.`);
    console.error('  This file\'s hash has drifted. Every result below would be wrong.');
    process.exit(1);
  }
  console.log(`ckey verified against all ${mine.length} shipped cards ✓`);
}
checkKeyImpl();

const path = process.argv[2] ?? 'audit/flags.json';
if (!existsSync(path)) {
  console.error(`no flags file at ${path}`);
  console.error('Open the tool → ··· → All cards → ⚑ Flagged → "Download as a file", and save it there.');
  process.exit(1);
}
const data = JSON.parse(readFileSync(path, 'utf8'));
const flags = data.flags ?? data;
if (data.pack && data.pack !== pack.id)
  console.warn(`⚠ this export is from pack "${data.pack}" but pack.js is "${pack.id}" — keys will not resolve`);

const live = [], stale = [];
for (const f of flags) (byKey.has(f.ck) ? live : stale).push(f);

const REASON = { answer: 'ANSWER IS WRONG', question: 'QUESTION IS WRONG', unclear: 'UNCLEAR', typo: 'TYPO', misfiled: 'WRONG TOPIC', dupe: 'DUPLICATE', other: 'OTHER' };
const answerOf = (c) => {
  switch (c.type) {
    case 'flash': return strip(c.a ?? '');
    case 'mcq': return strip(c.options[c.correct]);
    case 'cloze': return (c.blanks ?? []).map((b, i) => `${i + 1}. ${strip(b.options[b.correct])}`).join(' · ');
    case 'order': return c.steps.map((s, i) => `${i + 1}. ${strip(s)}`).join('\n      ');
    case 'tfset': return c.statements.map(s => `${s.v ? 'T' : 'F'} — ${strip(s.s)}`).join('\n      ');
    case 'match': return c.pairs.map(p => `${strip(p[0])} → ${strip(p[1])}`).join('\n      ');
    default: return (c.points ?? []).map((p, i) => `${i + 1}. ${strip(p)}`).join('\n      ');
  }
};

console.log(`\n${flags.length} flag(s) from ${path} · exported ${data.exported ?? '?'}`);
console.log(`${live.length} point at a card still in the pack, ${stale.length} do not.\n`);

/* Sorted by reason so the two that mean "this is factually wrong" are read first —
   a typo report and a wrong answer key are not the same size of problem. */
const order = ['answer', 'question', 'unclear', 'misfiled', 'dupe', 'typo', 'other'];
live.sort((a, b) => order.indexOf(a.reason) - order.indexOf(b.reason));

for (const f of live) {
  const c = byKey.get(f.ck);
  console.log('─'.repeat(78));
  console.log(`⚑ ${REASON[f.reason] ?? f.reason}${f.note ? `  —  "${f.note}"` : ''}`);
  console.log(`   ${c.type} · topic ${c.topic} · focus point ${c.crit ?? '—'} · tier ${c.tier ?? '—'}${c.bg ? ' · background' : ''}`);
  console.log(`   Q: ${strip(c.q).replace(/\s+/g, ' ')}`);
  if (c.text) console.log(`   passage: ${strip(c.text).replace(/\s+/g, ' ').slice(0, 200)}`);
  console.log(`   A: ${answerOf(c)}`);
  if (c.why) console.log(`   why: ${strip(c.why).replace(/\s+/g, ' ')}`);
  if (c.model) console.log(`   model: ${strip(c.model).replace(/\s+/g, ' ')}`);
  const ev = [].concat(c.ev ?? []);
  for (const e of ev) console.log(`   source: ${e.quiz ? `${e.quiz} ${e.n ?? ''}` : `${e.src ?? '?'}${e.loc ? ' · ' + e.loc : ''}`}`);
  console.log(`   key: ${f.ck}`);
}

if (stale.length) {
  console.log('\n' + '═'.repeat(78));
  console.log(`${stale.length} flag(s) no longer match a card. The card was almost certainly edited`);
  console.log('after it was flagged — check, then delete these from the export.\n');
  for (const f of stale) {
    console.log(`⚑ ${REASON[f.reason] ?? f.reason}${f.note ? `  —  "${f.note}"` : ''}`);
    console.log(`   was: ${String(f.q ?? '').replace(/\s+/g, ' ').slice(0, 150)}`);
    console.log(`   key: ${f.ck}\n`);
  }
}
console.log('');
