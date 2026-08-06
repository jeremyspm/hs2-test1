/* Phase 4 item 3b — bind optimised images onto the harvested cards.
   Moves `[[IMG:hash]]` markers out of the stem and into the engine's `fig` field, which
   figHTML() renders inside `.figwrap` (already `width:100%`, so mobile-safe).

   A card whose stem points at an image that does NOT resolve is not silently cleaned up.
   It is flagged `figMissing`, and G11 refuses to ship it — a question that says "examine
   the figure above" with no figure is not a weaker card, it is an unanswerable one.

   Output: audit/harvested-bound.js + audit/bind-report.json. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const images = JSON.parse(fs.readFileSync(path.join(HERE, 'images-optimised.json'), 'utf8'));
const { HARVESTED } = await import(pathToFileURL(path.join(HERE, 'harvested.js')).href);

/* Any way a card can end up claiming there is a figure to look at. */
const EMBEDDED = /\[\[IMG:([0-9a-f]{16})\]\]/g;
const NAMED = /\[\[IMG:((?![0-9a-f]{16}\]\])[^\]]*)\]\]/g;
/* Bare `[[IMG]]` — no colon, no name — is what an external <img> with no alt text
   becomes. A pattern requiring the colon leaves these in the stem, so cards shipped
   reading "Identify the structures in the image below. [[IMG]]". */
const BARE = /\[\[IMG\]\]/g;
const PLACEHOLDER = /\[image not available offline\]/g;
const DEICTIC = /\b(figure|image|diagram|micrograph|photo|graph|picture)\b[^.]{0,40}\b(above|below|shown|here|following)\b|\b(above|below|shown)\b[^.]{0,25}\b(figure|image|diagram)\b|\blabell?ed\b|\bin the (image|figure|diagram)\b/i;

/* ── an INCOMPLETE figure set is a hard hold ─────────────────────────────────────
   DEICTIC above asks "does the stem point at a picture?", which is the wrong question
   for the questions that name their pictures individually — "Image C", "SLIDE 4" — and
   ask you to match each one to a description. Her lung-histology matcher offers five
   images; three of the five are external URLs that were never captured. Two bind, the
   card gets a `fig`, and every check below is satisfied: it is not missing a figure, so
   it ships. Three of its five options then point at nothing. That is worse than a card
   that is absent, because it looks answerable right up until you try to answer it.

   So count the labels the card NAMES against the figures it actually GOT. This is
   arithmetic, not an opinion about wording: a card naming no labels is untouched, which
   is why the four cards that merely lost a decorative external image still ship.

   Two guards, because a wrongly held card does not announce itself — it just quietly
   is not in the deck:
     · a lower-case letter is prose ("in the image a vessel is visible"), not a label
     · one label is not a set. Real label sets run A, B, C — and a lone "Figure 1" in a
       sentence is a reference, not an enumeration. */
const LABEL = /\b(?:image|slide|figure|diagram|panel)\s*([A-Za-z]|\d{1,2})\b/gi;
const labelsNamed = (c) => {
  const src = JSON.stringify([c.q, c.text, c.options, c.pairs, c.statements, c.blanks]);
  const seen = new Set();
  for (const m of src.matchAll(LABEL)) {
    const tag = m[1];
    if (/^[a-z]$/.test(tag)) continue;               // prose, not a label
    if (/^[A-Z]$/.test(tag) && !/^[A-H]$/.test(tag)) continue;
    seen.add(m[0].toUpperCase().replace(/\s+/g, ' '));
  }
  return seen.size > 1 ? seen : new Set();
};

/* Wording that mentions a picture without enumerating one. No rule may fire on it, or a
   sound card is held and the only symptom is a card missing from the deck. Same shape as
   the control list in map-criteria.mjs, and for the same reason. */
for (const s of ['Study the image and answer the question', 'Identify the structures in the image below',
                 'as shown in the diagram above', 'in the image a large vessel is visible',
                 'see figure 1 of the lecture notes']) {
  const hit = labelsNamed({ q: s });
  if (hit.size) {
    console.error(`✗ the figure-label rule fires on prose that enumerates nothing:\n    "${s}" → ${[...hit].join(', ')}`);
    process.exit(1);
  }
}

const walk = (v, fn) => Array.isArray(v) ? v.map(x => walk(x, fn))
  : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, k === 'ev' ? x : walk(x, fn)]))
  : typeof v === 'string' ? fn(v) : v;

const bound = [];
const report = { bound: 0, figMissing: [], noFigureNeeded: 0, multi: 0, incomplete: 0 };

for (const card of HARVESTED) {
  const json = JSON.stringify(card);
  const embedded = [...new Set([...json.matchAll(EMBEDDED)].map(m => m[1]))];
  const named = [...new Set([...json.matchAll(NAMED)].map(m => m[1]))];
  const hasPlaceholder = PLACEHOLDER.test(json);
  const bareCount = (json.match(BARE) || []).length;

  const resolved = embedded.filter(h => images[h]);
  const unresolved = [...embedded.filter(h => !images[h]), ...named,
                      ...Array(bareCount).fill('an unnamed external image')];

  /* strip every marker from the visible text; the figure moves to `fig` */
  let c = walk(card, s => s.replace(EMBEDDED, ' ').replace(NAMED, ' ').replace(BARE, ' ').replace(PLACEHOLDER, ' ')
    .replace(/\s{2,}/g, ' ').trim());

  /* Counted BEFORE the figure is attached, and on the cleaned card, so the labels come
     from what a reader would see rather than from the markers being stripped. */
  const namedFigs = labelsNamed(c);
  const shortSet = namedFigs.size > resolved.length;

  if (resolved.length && !shortSet) {
    c.fig = resolved.map(h => `<img src="${images[h]}" alt="Figure from her quiz question">`).join('');
    c.figcap = `From ${card.ev.quiz} · ${card.ev.n}`;
    report.bound++;
    if (resolved.length > 1) report.multi++;
  }

  /* Two different failures, and conflating them loses good cards.

     DEPENDENT — the stem cannot be answered without the picture: "the structure
     labelled B", "shown in the image", "examine the figure above". These are
     unanswerable and must not ship.

     DECORATIVE — the card merely HAD an image. Her "Electogenics of the heart" match
     card pairs definitions to terms and reads perfectly without it. Holding it would
     discard a sound question over a missing decoration.

     Both are held by default, because shipping an unanswerable card is the worse error;
     but they are reported separately so the decorative ones can be released by a human
     in one pass instead of being silently binned. */
  const stem = [c.q, c.text].filter(Boolean).join(' ');
  const dependent = DEICTIC.test(stem);
  const hadImage = hasPlaceholder || unresolved.length > 0;
  if (shortSet) {
    c.figMissing = `the card names ${namedFigs.size} figures (${[...namedFigs].join(', ')}) but only ${resolved.length} survived the capture`;
    c.figHold = 'incomplete';
    report.incomplete++;
    report.figMissing.push({ quiz: card.ev.quiz, n: card.ev.n, type: card.type,
                             hold: c.figHold, why: c.figMissing, q: stem.slice(0, 90) });
  } else if ((dependent || hadImage) && !c.fig) {
    c.figMissing = dependent
      ? 'the stem cannot be answered without a figure the pack does not have'
      : 'the source question carried an image that is not recoverable offline, but the card reads without it';
    c.figHold = dependent ? 'dependent' : 'decorative';
    report.figMissing.push({ quiz: card.ev.quiz, n: card.ev.n, type: card.type,
                             hold: c.figHold, why: c.figMissing, q: stem.slice(0, 90) });
  } else if (!c.fig) {
    report.noFigureNeeded++;
  }
  bound.push(c);
}

fs.writeFileSync(path.join(HERE, 'harvested-bound.js'),
  `/* GENERATED by audit/bind-images.mjs — do not edit by hand. */\nexport const BOUND = ${JSON.stringify(bound, null, 1)};\n`);
fs.writeFileSync(path.join(HERE, 'bind-report.json'), JSON.stringify(report, null, 1));

const payload = bound.filter(c => c.fig).reduce((n, c) => n + c.fig.length, 0);
console.log('══ IMAGE BINDING ═══════════════════════════════════');
console.log(`  ${bound.length} cards`);
console.log(`    ${report.bound} bound to a figure${report.multi ? ` (${report.multi} with more than one)` : ''}`);
console.log(`    ${report.noFigureNeeded} need no figure`);
const dep=report.figMissing.filter(f=>f.hold==='dependent');
const dec=report.figMissing.filter(f=>f.hold==='decorative');
const inc=report.figMissing.filter(f=>f.hold==='incomplete');
console.log(`    ${dep.length} UNANSWERABLE without a figure — hard hold (G11)`);
console.log(`    ${inc.length} name more figures than survived the capture — hard hold`);
console.log(`    ${dec.length} had a decorative image only — hold, but releasable on review`);
console.log(`  inlined payload: ${(payload / 1048576).toFixed(2)} MB of base64`);
if (report.figMissing.length) {
  console.log('\n  held:');
  for (const f of report.figMissing) console.log(`    [${f.type}] ${f.q}\n        ${f.why}`);
}
console.log('\nwrote audit/harvested-bound.js, bind-report.json');

/* ── the image budget, enforced on what actually ships ───────────────────────────
   It used to live in optimise-images.py, which cannot see it: that step encodes every
   image a harvested card REFERENCES, but a card held below never ships one, and a card
   bound to two images inlines both data URIs into its own `fig` — so an image used
   twice ships twice. Its 2.33 MB was measuring neither the cards that ship nor the
   bytes they carry, and the payload it passed was really 2.46 MB.

   Here the number is just the sum of what goes into index.html. `figHold` is the
   remedy the failure should point at first: an unanswerable card holding 200 KB of
   base64 is two problems, not one. */
const BUDGET = 2 * 1048576;
/* `payload` above is already exactly this: a held card never reaches `c.fig` — the two
   hold branches are the only paths that do not set it — so summing the cards that HAVE
   one is summing the cards that ship one. Asserted rather than assumed. */
const shipping = bound.filter(c => c.fig);
const stowaway = shipping.filter(c => c.figHold);
if (stowaway.length) {
  console.error(`✗ ${stowaway.length} held card(s) still carry inlined image data — the budget below would be counting bytes that never ship`);
  process.exit(1);
}
if (payload > BUDGET) {
  console.error(`\n✗ shipped image payload is ${(payload / 1048576).toFixed(2)} MB of base64, over the 2.00 MB budget by ${((payload - BUDGET) / 1048576).toFixed(2)} MB.`);
  console.error(`  ${shipping.length} card(s) carry a figure. Largest:`);
  for (const c of [...shipping].sort((a, b) => b.fig.length - a.fig.length).slice(0, 5)) {
    console.error(`    ${(c.fig.length / 1024).toFixed(0)} KB  ${c.ev.quiz.slice(0, 40)} ${c.ev.n}`);
  }
  console.error('  Lower the `detail` profile in optimise-images.py (width, then quality) and re-run.');
  process.exit(1);
}
