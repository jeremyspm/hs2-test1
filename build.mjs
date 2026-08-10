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
/* ── runtime smoke test ───────────────────────────────────────────────────────
   THE PARSE CHECK ABOVE IS NOT ENOUGH, and this exists because it let a dead build
   through. A `const` declared 500 lines below its first use is syntactically perfect
   and throws "Cannot access X before initialization" the moment the page runs — the
   whole app died before rendering a single card, and every gate below still passed
   because they read the pack object, not the page.

   So: execute the shipped page's main script against a stub DOM and require it to reach
   the end. This cannot prove the tool WORKS — only a browser does that — but it catches
   the class of failure where the file is fine and the program is not, which is the one
   the parse check is blind to and the one that ships silently. */
{
  const script = [...out.matchAll(/<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]).sort((a, b) => b.length - a.length)[0];
  const el = () => new Proxy({}, {
    get: (t, k) => k === 'style' || k === 'classList' || k === 'dataset' ? el()
      : k === 'innerHTML' || k === 'textContent' || k === 'value' || k === 'className' ? ''
      : k === 'hidden' || k === 'checked' ? false
      : typeof k === 'string' && k.startsWith('on') ? null
      : el,
    set: () => true,
    apply: () => el(),
  });
  const doc = {
    querySelector: () => el(), querySelectorAll: () => [],
    addEventListener() {}, createElement: () => el(), documentElement: el(), body: el(),
    get title() { return this._t ?? ''; }, set title(v) { this._t = v; },
  };
  const store = new Map();
  const ctx = {
    document: doc, console: { log() {}, warn() {}, error() {} },
    localStorage: { getItem: k => store.has(k) ? store.get(k) : null, setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) },
    location: { search: '', origin: 'file://', pathname: '/index.html', href: '' },
    matchMedia: () => ({ matches: false, addEventListener() {} }),
    setTimeout: () => 0, setInterval: () => 0, clearInterval() {}, requestAnimationFrame: () => 0,
    URLSearchParams, Date, Math, JSON, Object, Array, String, Number, Boolean, RegExp, Set, Map, Proxy, isNaN, parseInt, parseFloat, encodeURIComponent, decodeURIComponent,
  };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx;
  const vm = await import('node:vm');
  vm.createContext(ctx);
  /* ── G13: every filter option delivers the number it advertises ──────────────
     "Rep only…" prints a count on each chip and then deals a queue. Those are two
     predicates over the same cards, and they drifted the day they were written: the
     panel counted "No source recorded" with `provOf` (which files the 46 rails
     there, as every other view does) while the queue matched on `c.tier` raw, so the
     chip promised 46 cards and dealt nought. A reader cannot tell a filter that
     matches nothing from a pack that contains nothing.

     Appended to the shipped script rather than run against `ctx`, because `const`
     declarations in a classic script are script-scoped and never become properties
     of the vm's global — reaching them from outside would silently find `undefined`
     and pass. Same rule as the ckey fixture: check the artifact, in its own scope. */
  const GATE = `
    ;(function(){
      const bad=[], keep=JSON.stringify(S.filters);
      for(const d of filtDims(ALLTYPES)) for(const o of d.opts){
        S.filters=FILT0(); S.filters[d.id]=[o.id];
        const n=deckSource(ALLTYPES).length;
        const fresh=filtDims(ALLTYPES).find(x=>x.id===d.id).opts.find(x=>x.id===o.id);
        if(!fresh||fresh.n!==n) bad.push(d.id+'/'+o.id+': the chip says '+(fresh?fresh.n:'gone')+', the queue deals '+n);
      }
      S.filters=JSON.parse(keep);
      globalThis.__FILTMISMATCH__=bad;
      globalThis.__FILTCHECKED__=filtDims(ALLTYPES).reduce((a,d)=>a+d.opts.length,0);
    })();
  `;
  try {
    vm.runInContext(script + GATE + '\n;globalThis.__REACHED_END__=true;', ctx, { filename: 'index.html', timeout: 15000 });
  } catch (e) {
    console.error(`✗ the shipped page THROWS at run time: ${e.message}`);
    console.error('  The file parses; the program does not run. Nothing below this would have caught it.');
    process.exit(1);
  }
  if (!ctx.__REACHED_END__) { console.error('✗ the shipped page did not finish executing'); process.exit(1); }
  console.log('shipped page executes end-to-end against a stub DOM ✓');

  const mm = ctx.__FILTMISMATCH__ ?? null;
  if (mm === null) { console.error('✗ the filter gate did not run — has filtDims/deckSource been renamed?'); process.exit(1); }
  if (mm.length) {
    console.error(`✗ ${mm.length} filter option(s) advertise a count they do not deal:`);
    for (const m of mm.slice(0, 10)) console.error('    ' + m);
    console.error('\n✗ NOT SHIPPING. A chip that promises 46 cards and deals none is worse than no filter.');
    process.exit(1);
  }
  console.log(`all ${ctx.__FILTCHECKED__} "Rep only…" options deal exactly the count they advertise ✓`);

  /* ── G14: All cards' "as tested" view is the study card, not a copy of it ─────
     The whole claim of that view is that a card looks there exactly as it looks when
     you are being tested on it, and the only thing making that true is that both go
     through `cardHeadHTML` and `faceHTML`. A well-meant future fix that inlines the
     markup instead — to tweak a size, to drop a button — breaks the claim silently,
     because both pages still look plausible. Cheap structural check, in the artifact. */
  const face = script.match(/function libTestCardHTML\(c\)\{[\s\S]*?\n\}/);
  if (!face) { console.error('✗ libTestCardHTML not found — the as-tested view has been renamed or removed'); process.exit(1); }
  const missing = ['cardHeadHTML(', 'faceHTML('].filter(fn => !face[0].includes(fn));
  if (missing.length) {
    console.error(`✗ NOT SHIPPING. libTestCardHTML no longer calls ${missing.join(' or ')} — "as tested" would be a lookalike, not the card.`);
    process.exit(1);
  }
  if ((script.match(/function faceHTML\(/g) || []).length !== 1) {
    console.error('✗ NOT SHIPPING. More than one faceHTML — the study card and the browse view can now drift.');
    process.exit(1);
  }
  console.log('“as tested” renders through the study card’s own head/face functions ✓');
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
   THE FLOOR STOPPED BEING A SHIP BLOCKER when the manufactured cards were culled.

   It used to mean "author until every focus point has 6 cards", and it worked: the
   build refused to ship a thin focus point, so one got written up to the line. Twelve
   of them were standing on cards written for no other reason than to clear it —
   measurably the least readable cards in the pack, sitting on ground the lecturer's
   own questions already covered.

   The pack now ships only what is sourced back to her material. Under that rule the
   floor can only be cleared by MINING more of her material, and where there is no more
   to mine the true number is the low one. A gate that fails the build on it is just a
   standing order to manufacture — the exact thing being removed. So:

     zero cards  → still a hard failure. An empty focus point is a hole, and the reader
                   meets it as a topic with nothing in it.
     below floor → DECLARED. `PACK.thin` carries it, the page tells the reader, and
                   apply-migration prints it as the work list for the next mining pass.

   `blindNeedsSaq` goes the same way and for the same reason: resp-15 and resp-16 have
   zero questions from her anywhere in the course, so demanding a written-answer card
   on them is demanding an invented one. */
const counts = {};
for (const c of P.cards) for (const id of [c.crit, ...(c.alsoCrit ?? [])].filter(Boolean)) counts[id] = (counts[id] || 0) + 1;

const empty = (P.criteria ?? []).filter(c => !counts[c.id]);
if (empty.length) {
  console.error(`✗ ${empty.length} focus point(s) with NO cards at all: ${empty.map(c => c.id).join(', ')}`);
  console.error('\n✗ NOT SHIPPING. A focus point the reader cannot reach is a hole, not thin coverage.');
  process.exit(1);
}
console.log(`all ${(P.criteria ?? []).length} focus points have at least one card ✓`);

/* ── the three criterion-integrity gates (C1, C2, C6) ─────────────────────────
   Added 11 Aug 2026 with the rebuild spec, and every one of them was failing when
   it was written. They exist because the ring system about to be built on this data
   deals cards BY focus point, so a card with no focus point is a card no reader will
   ever be dealt, and a focus point with no card of its own has no spine card to lead
   with. A queue that looks principled and is tagged wrong is worse than pack order.

   `rail` cards are outside all of this by design — they carry no crit, are appended
   after the coverage maths, and are a different kind of study object. See the note in
   apply-migration.mjs where they are added. */
{
  const drillable = P.cards.filter(c => c.type !== 'rail');
  const critsOf = (c) => [c.crit, ...(c.alsoCrit ?? [])].filter(Boolean);

  // C1 — a card the criterion-ordered queue can never deal
  const orphans = drillable.filter(c => !critsOf(c).length);
  if (orphans.length) {
    console.error(`✗ ${orphans.length} card(s) carry no focus point at all:`);
    for (const c of orphans.slice(0, 8)) console.error(`    [${c.type} ${c.tier}] ${String(c.q ?? '').replace(/<[^>]+>/g, '').slice(0, 76)}`);
    console.error('\n✗ NOT SHIPPING. Route them in audit/routes.json, or write the rule in map-criteria.mjs.');
    process.exit(1);
  }

  // C2 — a focus point that is nothing's primary subject has no spine card
  const primary = {};
  for (const c of drillable) if (c.crit) primary[c.crit] = (primary[c.crit] ?? 0) + 1;
  const noPrimary = (P.criteria ?? []).filter(c => !primary[c.id]);
  if (noPrimary.length) {
    console.error(`✗ ${noPrimary.length} focus point(s) with no card whose primary subject they are: ${noPrimary.map(c => c.id).join(', ')}`);
    console.error('   An alsoCrit mention is a card about something else. Declare a `crit` in audit/routes.json.');
    console.error('\n✗ NOT SHIPPING.');
    process.exit(1);
  }
  console.log(`every focus point is the primary subject of at least one card ✓  (thinnest: ${Object.entries(primary).sort((a, b) => a[1] - b[1])[0].join(' with ')})`);

  /* C6 — a card may not claim more focus points than it has parts to test them with.
     The cap is per-card and relative, because "too many" is not a fixed number: her
     50-mark formative Q4 is one question with ten keyed blanks covering ten different
     things, and tagging it ten ways is accurate. A single-answer multiple choice tagged
     four ways is the defect — usually because a rule fired on a DISTRACTOR, which is the
     card being described by the answers it is trying to rule out.

     parts + 3 is where the reviewed pack actually sits: after the 11 Aug rule pass the
     worst single-answer card carries 4, and each of those four is a real factor named in
     its own options. The gate locks that review in rather than proposing a new ideal. */
  const partsOf = (c) => (c.blanks?.length || c.pairs?.length || c.statements?.length || c.points?.length || c.steps?.length || 1);
  const overtagged = drillable.map(c => ({ c, n: critsOf(c).length, p: partsOf(c) })).filter(x => x.n > x.p + 3);
  if (overtagged.length) {
    console.error(`✗ ${overtagged.length} card(s) claim more focus points than they can test:`);
    for (const x of overtagged.slice(0, 8)) console.error(`    ${x.n} points / ${x.p} part(s) [${x.c.type}] ${critsOf(x.c).join(',')} — ${String(x.c.q ?? '').replace(/<[^>]+>/g, '').slice(0, 56)}`);
    console.error('\n✗ NOT SHIPPING. Trim them with a `drop` in audit/routes.json, or tighten the rule that fired.');
    process.exit(1);
  }
  const worst = drillable.map(c => ({ n: critsOf(c).length, p: partsOf(c) })).sort((a, b) => (b.n - b.p) - (a.n - a.p))[0];
  console.log(`no card claims more focus points than it can test ✓  (closest: ${worst.n} points over ${worst.p} part(s))`);

  /* C5 — what the SPINE CARD of each focus point is made of.
     Ring 0 deals one card per focus point and says, in effect, "answer this and you have
     covered that part of the paper". The claim is only as good as the card: a `verbatim`
     spine is one of Hannetjie's own questions, a `taught` spine is her lecture pinned by a
     quote, and a `textbook` spine is a sentence this pack wrote about a topic the course
     has never been observed to ask. All three are legitimate to ship; only the last one
     must never be shipped SILENTLY.

     So the rule is not "every spine must be verbatim" — that would be a demand to invent
     questions. It is: a focus point that cannot field one of her own questions has to be
     saying so in the pack, and a focus point standing entirely on background reading has
     to carry a sentence explaining that to the reader. Both directions are checked, so a
     note that stops being true fails the build instead of reassuring nobody. */
  const RANK = { verbatim: 3, taught: 2, textbook: 1 };
  const spineTrouble = [], staleNote = [];
  for (const cr of P.criteria ?? []) {
    const mine = drillable.filter(c => c.crit === cr.id);
    const best = Math.max(0, ...mine.map(c => RANK[c.tier] ?? 0));
    if (best === 3) {
      if (cr.acknowledgedGap) staleNote.push(`${cr.id}: carries an acknowledged-gap note, but its spine card is now one of Hannetjie's own questions — delete the note in apply-migration.mjs`);
      continue;
    }
    if (!cr.blind) spineTrouble.push(`${cr.id}: best card for it is \`${best === 2 ? 'taught' : 'textbook'}\`, but the pack does not mark the point as never-practised — the reader is told nothing`);
    if (best === 1 && !cr.acknowledgedGap) spineTrouble.push(`${cr.id}: every card on it is background reading and there is no acknowledged-gap note saying so`);
    // the engine renders this note through esc(); markup in it reaches the reader as angle brackets
    if (/[<>]/.test(cr.acknowledgedGap ?? '')) spineTrouble.push(`${cr.id}: the acknowledged-gap note contains markup, and the engine escapes it — write it in plain text`);
    if (best === 0) spineTrouble.push(`${cr.id}: no card is primarily about it at all`);
  }
  if (spineTrouble.length || staleNote.length) {
    for (const m of [...spineTrouble, ...staleNote]) console.error(`✗ ${m}`);
    console.error('\n✗ NOT SHIPPING. A focus point whose spine card is not one of her questions must say so.');
    process.exit(1);
  }
  const byTier = { verbatim: 0, taught: 0, textbook: 0 };
  for (const cr of P.criteria ?? []) {
    const best = Math.max(0, ...drillable.filter(c => c.crit === cr.id).map(c => RANK[c.tier] ?? 0));
    byTier[best === 3 ? 'verbatim' : best === 2 ? 'taught' : 'textbook']++;
  }
  console.log(`spine cards: ${byTier.verbatim} focus points can field one of her own questions, ${byTier.taught} her lecture, ${byTier.textbook} background reading (declared) ✓`);
}

/* The declaration has to REACH the reader, or culling to honest numbers just means
   quietly shipping thinner coverage. Prove the pack carries it and the engine renders
   it, rather than trusting that it does. */
const thin = P.thin ?? [];
if (thin.length) {
  console.log(`${thin.length} focus point(s) declared thin: ` + thin.map(t => `${t.id} ${t.n}/${t.floor}`).join(' · '));
  const stale = thin.filter(t => (counts[t.id] || 0) !== t.n);
  if (stale.length) {
    console.error(`✗ PACK.thin disagrees with the cards actually in the pack: ${stale.map(t => `${t.id} says ${t.n}, pack has ${counts[t.id] || 0}`).join(' · ')}`);
    process.exit(1);
  }
  if (!tpl.includes('PACK.thin')) {
    console.error('✗ NOT SHIPPING. The pack declares thin focus points but the engine never reads PACK.thin — the reader would never be told.');
    process.exit(1);
  }
}
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
