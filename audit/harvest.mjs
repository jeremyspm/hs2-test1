/* Phase 3 — turn her parsed questions into pack cards.
   MECHANICAL. Nothing here authors content: question text, options and keys are copied
   from questions.json, which was extracted from her Canvas captures. Where a faithful
   card cannot be built, the question is SKIPPED with a reason — never patched up.

   Output: harvested.js (a card array) + harvest-report.json.
   Merging into pack.js is Phase 4, deliberately not done here. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const { quizzes } = JSON.parse(fs.readFileSync(path.join(HERE, 'questions.json'), 'utf8'));

const skipped = [];
const cards = [];
const skip = (z, q, why) => skipped.push({ quiz: z.title, n: q.n, type: q.type, why, q: q.q.slice(0, 90) });

/* ── topic + criterion routing ───────────────────────────────────────────────
   Derived from the quiz a question came from — she files them by system already —
   refined by keyword only where a quiz spans systems. Every card records `routedBy`
   so Phase 4 can see which ones were guessed rather than known. */
const QUIZ_TOPIC = [
  [/CVS1 BLOOD VESSELS/i, 'cvs-vessels'],
  [/CVS2 THE HEART|HEART COVERINGS/i, 'cvs-anat'],
  [/CVS3 CARDIAC CONDUCTION/i, 'cvs-ecg'],
  [/CVS HOMEOSTASIS/i, 'cvs-bp'],
  [/SHOCK QUIZ/i, 'cvs-output'],
  [/RESP BASIC ANATOMY|Pre-Lab|Terminology Assessment/i, 'resp-anat'],
  [/RESPIRATORY SYSTEM BASIC PHYSIOLOGY|SAQ RESPIRATORY/i, 'resp-mech'],
  [/LYMPHATIC|FLUID, ELECTROLYTE/i, 'lymph'],
  [/CVS REVIEW|CVS LAB REVIEW/i, 'cvs-anat'],
  [/Practice Lab 1/i, 'cvs-anat'],
  [/Practice Lab 2/i, 'resp-anat'],
  /* The three Module 1.2 quizzes captured 6 Aug 2026. Without these the 27 questions
     they contribute that name no routable keyword fall through to `terms` — a topic the
     pack RETIRED, which apply-migration then silently re-files under resp-anat. Gas-law
     and acid-base cards arriving in "Respiratory anatomy" is not a routing decision,
     it is the absence of one. */
  [/RESPIRATORY SYSTEM GAS LAWS|RESPIRATION BLOOD CARRYING GASES/i, 'resp-gas'],
  [/STUDENT MARKED.*RESPIRATORY PRACTICE TEST/i, 'resp-anat'],
];
const KEYWORD_TOPIC = [
  [/\bECG\b|P wave|QRS|repolaris|depolaris|heart sound|S1|S2|murmur|conduction/i, 'cvs-ecg'],
  [/blood pressure|baroreceptor|renin|angiotensin|aldosterone|vasoconstrict/i, 'cvs-bp'],
  [/shock|cardiac output|stroke volume|venous return/i, 'cvs-output'],
  [/artery|vein|capillar|vessel|oedema|hydrostatic|oncotic/i, 'cvs-vessels'],
  [/alveol|gas exchange|partial pressure|haemoglobin|hemoglobin|oxygen transport|carbon dioxide transport/i, 'resp-gas'],
  [/tidal volume|lung volume|spiromet|compliance|pleural|ventilation|breathing mechanic/i, 'resp-mech'],
  [/chemoreceptor|medull|respiratory centre|control of breathing|hypercapn/i, 'resp-control'],
  [/lymph|spleen|thymus|tonsil/i, 'lymph'],
  [/vaccin|immunis|immuniz|antigen|antibody|lymphocyte|immune/i, 'immune'],
  [/valve|atri|ventricl|pericard|myocard|endocard|septum|heart wall/i, 'cvs-anat'],
  [/trachea|bronch|larynx|pharynx|nose|nasal|pleura|lung tissue/i, 'resp-anat'],
  /* ── added 6 Aug 2026 with the gas-laws / blood-gases / practice-test captures ──
     APPENDED, NEVER INSERTED. routeTopic returns on the first keyword hit, so a rule
     placed above an existing one can quietly re-file cards that have been routing
     correctly for three passes. Appended, these can only claim questions that reach
     the end of the list — which today is 27 questions, all of them new. */
  [/\bexternal respiration\b|\binternal respiration\b|gas law|atmospher/i, 'resp-gas'],
  [/oxygen is transported|carbon dioxide is transported|carbon dixoide is transported|hypoxia|oxygen exchange/i, 'resp-gas'],
  [/acidosis|alkalosis|blood pH|\bpH of\b/i, 'resp-control'],
  [/inspiration|expiration|inhalation|exhalation|diaphragm|intercostal|elastic recoil/i, 'resp-mech'],
  [/patent or open airway|trachealis|carina|self cleaning|muco-?cili/i, 'resp-anat'],
];

function routeTopic(z, q) {
  for (const [re, topic] of KEYWORD_TOPIC) if (re.test(q.q)) return { topic, routedBy: 'keyword' };
  for (const [re, topic] of QUIZ_TOPIC) if (re.test(z.title)) return { topic, routedBy: 'quiz' };
  return { topic: 'terms', routedBy: 'fallback' };
}

/* ── shared card fields ──────────────────────────────────────────────────── */
const evFor = (z, q) => ({ quiz: z.title, capture: z.file, captureSha: z.sha256, n: q.n });

/* Image refs survive as markers; build.mjs resolves them from question-images.json.
   Questions whose only content is an external (non-embedded) image are dropped —
   the card would be unanswerable offline. */
const EXTERNAL_IMG = /\[\[IMG:(?![0-9a-f]{16}\]\])[^\]]*\]\]/g;
const hasEmbedded = (s) => /\[\[IMG:[0-9a-f]{16}\]\]/.test(s);

function cleanStem(s) {
  return s
    .replace(EXTERNAL_IMG, '[image not available offline]')
    .replace(/\s*Links to an external site\.\s*/gi, ' ')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

for (const z of quizzes) {
  for (const q of z.questions) {
    if (!q.q || q.q.length < 5) { skip(z, q, 'question is blank in Canvas'); continue; }
    const { topic, routedBy } = routeTopic(z, q);
    const base = { topic, tier: 'verbatim', ev: evFor(z, q), routedBy };
    const stem = cleanStem(q.q);
    if (/\[image not available offline\]/.test(stem) && stem.replace(/\[image not available offline\]/g, '').trim().length < 25) {
      skip(z, q, 'stem is essentially just an external image'); continue;
    }

    /* A "question" that tells the reader to go and do something elsewhere and write down
       what they scored is an admin prompt, not an assessable question. MODULE 1.2:
       RESPIRATORY KHAN is entirely this — a link out to an external quiz plus "RECORD
       YOUR SCORE OUT OF 7 ______". Harvested, it became a self-marked SAQ carrying a
       marking schedule that cannot exist, which then failed the selfmark gate by
       demanding an answer be authored for it. There is no answer to author, and writing
       one would put an invented card under a `verbatim` badge. */
    if (/record your (quiz )?(result|score)|do the linked quiz/i.test(stem)) {
      skip(z, q, 'an instruction to sit an external quiz and self-report a score, not a question'); continue;
    }

    if (q.type === 'essay_question') {
      /* Her question, verbatim. The marking schedule is NOT hers — Canvas holds no key
         for a self-marked question — so it is left empty here and authored in a
         separate, per-point-evidenced pass. Emitting a guessed schedule under a
         `verbatim` card would be exactly the failure this rebuild exists to stop. */
      cards.push({ ...base, type: 'saq', q: stem, marks: q.points ?? null,
        points: [], pointsTier: 'TODO', needsSchedule: true });
      continue;
    }

    if (!q.key) { skip(z, q, q.keyWhy ?? 'no key extracted'); continue; }

    if (q.type === 'multiple_choice_question' || q.type === 'true_false_question') {
      const options = q.options.length ? q.options : (q.type === 'true_false_question' ? ['True', 'False'] : []);
      const correct = options.findIndex(o => q.key.correct.includes(o));
      if (options.length < 2) { skip(z, q, `only ${options.length} option(s) extracted`); continue; }
      /* The engine renders 2-6 options. One of her questions offers 7 (a label-the-
         diagram item keyed by letter). Removing an option to fit would change the
         question she asked, so it is skipped rather than trimmed. */
      if (options.length > 6) { skip(z, q, `her question offers ${options.length} options; the engine renders 2-6 and dropping one would change the question`); continue; }
      if (correct === -1) { skip(z, q, 'correct answer is not among the extracted options'); continue; }
      cards.push({ ...base, type: 'mcq', q: stem, options, correct });
      continue;
    }

    if (q.type === 'multiple_answers_question') {
      /* "Select all that apply" has no single index, so it becomes a true/false set —
         each option judged individually, which is the same knowledge, scored the way
         the engine can mark it. */
      const statements = q.options.map(o => ({ s: o, v: q.key.correct.includes(o) }));
      if (statements.length < 2) { skip(z, q, 'too few options for a tfset'); continue; }
      cards.push({ ...base, type: 'tfset', q: stem, statements });
      continue;
    }

    if (q.type === 'matching_question') {
      const pairs = q.key.pairs.map(p => [p.left, p.right]);
      if (!pairs.length) { skip(z, q, 'no pairs in key'); continue; }
      cards.push({ ...base, type: 'match', q: stem, pairs });
      continue;
    }

    if (q.type === 'fill_in_multiple_blanks_question') {
      /* NOT a cloze. Here the student TYPES the answer and the stored options are the
         ACCEPTED VARIANTS Canvas marks right — her blood-flow blank accepts "Tricuspid
         valve", "tricuspid", "Right atrioventricular valve", "Right AV" and "R
         atrioventricular valve" for one answer. Rendering those as multiple-choice
         would present four of her own accepted answers as wrong.

         Three of the four carry an explicit WORDLIST and numbered statements, which is
         a matching exercise written as blanks — so those become `match` cards, pairing
         each of her statements with the WORDLIST term she accepts for it. The fourth
         (a 13-step blood-flow sequence with no wordlist) has no faithful equivalent and
         is skipped. */
      const wordlist = (q.q.match(/WORDLIST\s+(.+?)(?=\s*\d+\.\s)/is) || [])[1];
      const numbered = [...q.q.matchAll(/(?:^|\s)(\d+)\.\s+(.+?)(?=\s+\d+\.\s|$)/gs)]
        .map(m => ({ n: +m[1], s: m[2].trim() }));
      const blanks = (q.key?.blanks ?? []);
      if (!wordlist || numbered.length !== blanks.length || !numbered.length) {
        skip(z, q, `fill-in-blank with no WORDLIST to match against (${numbered.length} statement(s), ${blanks.length} blank(s)) — options are accepted variants, not distractors`);
        continue;
      }
      const terms = wordlist.split(/,\s*/).map(t => t.trim()).filter(Boolean);
      const pairs = [];
      let unmatched = false;
      numbered.forEach((item, i) => {
        const accepted = blanks[i].options.map(o => o.toLowerCase());
        /* use the term as SHE spells it in the wordlist, chosen by matching any variant */
        const term = terms.find(t => accepted.includes(t.toLowerCase()));
        if (!term) { unmatched = true; return; }
        pairs.push([item.s.replace(/\s+/g, ' ').trim(), term]);
      });
      if (unmatched || !pairs.length) {
        skip(z, q, 'fill-in-blank: a blank\'s accepted answers do not appear in her own WORDLIST');
        continue;
      }
      const unusedTerms = terms.filter(t => !pairs.some(p => p[1] === t));
      cards.push({ ...base, type: 'match', q: `Match each statement to the correct term from her wordlist.`,
        pairs, ...(unusedTerms.length ? { distractors: unusedTerms } : {}), fromFillIn: true });
      continue;
    }

    if (q.type === 'multiple_dropdowns_question') {
      const blanks = q.key.blanks.filter(b => b.correct);
      /* A genuine dropdown offers one correct option among distractors. If a blank has
         only one option it is behaving like a typed answer and the same trap applies. */
      if (blanks.some(b => b.options.length < 2)) {
        skip(z, q, 'dropdown has a single-option blank — behaves as a typed answer, not a choice');
        continue;
      }
      if (!blanks.length) { skip(z, q, 'no blank has a marked correct option'); continue; }
      /* Her stem marks each blank with "[ Select ]" (dropdowns) or leaves the blank
         inline (fill-in). Replace them positionally with the engine's [[n]] markers. */
      let i = 0;
      let text = stem.replace(/\[\s*Select\s*\]/gi, () => `[[${++i}]]`);
      if (i === 0) { skip(z, q, 'stem has no [ Select ] markers to map blanks onto'); continue; }
      if (i !== blanks.length) { skip(z, q, `stem has ${i} blank marker(s) but the key has ${blanks.length}`); continue; }
      cards.push({
        ...base, type: 'cloze',
        q: `Complete the passage. (${z.title.replace(/:.*/, '')})`,
        text,
        blanks: blanks.map(b => ({ options: b.options, correct: b.options.indexOf(b.correct) })),
      });
      continue;
    }

    skip(z, q, `unhandled question type "${q.type}"`);
  }
}

/* ── write ───────────────────────────────────────────────────────────────── */
const out = `/* GENERATED by audit/harvest.mjs — do not edit by hand.
   ${cards.length} cards extracted verbatim from her Canvas quizzes.
   Question text, options and answer keys are HERS. Re-generate with:
     node audit/harvest.mjs
*/
export const HARVESTED = ${JSON.stringify(cards, null, 1)};
`;
fs.writeFileSync(path.join(HERE, 'harvested.js'), out);
fs.writeFileSync(path.join(HERE, 'harvest-report.json'), JSON.stringify({ cards: cards.length, skipped }, null, 1));

const byType = {};
for (const c of cards) byType[c.type] = (byType[c.type] ?? 0) + 1;
const byRoute = {};
for (const c of cards) byRoute[c.routedBy] = (byRoute[c.routedBy] ?? 0) + 1;

console.log('══ HARVEST ═════════════════════════════════════════');
console.log(`  ${cards.length} cards from ${quizzes.length} quizzes · ${skipped.length} question(s) skipped`);
console.log(`  types : ${Object.entries(byType).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(' · ')}`);
console.log(`  routed: ${Object.entries(byRoute).map(([k, v]) => `${k} ${v}`).join(' · ')}`);
const needing = cards.filter(c => c.needsSchedule).length;
console.log(`  ${needing} SAQ card(s) carry HER question with an EMPTY marking schedule (authored separately)`);
console.log('\n── NOT DONE HERE (Phase 4) ────────────────────────');
console.log(`  · no card carries a \`crit\` yet — mapping her questions onto the 36 blueprint`);
console.log(`    criteria is a judgement call, so coverage (G9/G10) cannot be computed from`);
console.log(`    these cards until that pass is done.`);
console.log(`  · topic routing is heuristic: ${Object.entries(byRoute).map(([k, v]) => `${v} by ${k}`).join(', ')} — every`);
console.log(`    card records \`routedBy\` so the guessed ones can be reviewed.`);
console.log(`  · ${cards.filter(c => /\[\[IMG:/.test(JSON.stringify(c))).length} card(s) reference an embedded image, resolved at build time.`);
console.log('\n── SKIPPED ────────────────────────────────────────');
const why = {};
for (const s of skipped) why[s.why.replace(/\d+/g, 'N')] = (why[s.why.replace(/\d+/g, 'N')] ?? 0) + 1;
for (const [w, n] of Object.entries(why).sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(3)}  ${w}`);
console.log('\nwrote audit/harvested.js, harvest-report.json');
