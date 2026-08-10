/* Phase 1b — parse the saved Canvas quiz pages into a question bank.
   These captures embed the answer key in the DOM, so the key is EXTRACTED, never
   inferred: `<span class="answer_weight">100</span>` / class `correct_answer`, and for
   matching questions Canvas's own `title="… The correct answer was 7."`.

   Nothing in this file authors content. If a key cannot be extracted the question is
   recorded with `key: null` and a reason, so the gap is visible rather than filled in. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const EXPORT = path.resolve(ROOT, '..', '_inbox', 'Health Science 2 Export Module 1');

/* ── tiny DOM-ish helpers ──────────────────────────────────────────────────────
   A real parser would be better, but these captures are machine-generated Canvas
   markup with stable class names, and the alternative is a dependency. Every
   extraction below is asserted against known-good values in verify-quizzes.mjs. */

const unesc = (s) => s
  .replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
  .replace(/&amp;/g, '&');

const IMAGES = new Map();   // sha1 -> data URI, kept out of questions.json

function textOf(html, { keepImages = true } = {}) {
  if (!html) return '';
  let s = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '');
  s = s.replace(/<img\b[^>]*>/gi, (tag) => {
    if (!keepImages) return ' ';
    const m = tag.match(/\ssrc="([^"]*)"/i);
    if (m && m[1].startsWith('data:')) {
      const id = crypto.createHash('sha1').update(m[1]).digest('hex').slice(0, 16);
      IMAGES.set(id, m[1]);
      return ` [[IMG:${id}]] `;
    }
    const alt = tag.match(/\salt="([^"]*)"/i);
    return alt ? ` [[IMG:${alt[1]}]] ` : ' [[IMG]] ';
  });
  s = s.replace(/<[^>]+>/g, ' ');
  /* Some of her question HTML contains malformed image tags — an unbalanced quote makes
     the tag close early, so the remaining attributes survive tag-stripping as literal
     text: `… associated with ' alt="Image result for electrocardiogram" loading=lazy
     style="…">`. Left alone these ship as visible garbage inside the question. Strip
     orphaned attribute fragments, which cannot legitimately occur in prose. */
  s = s
    .replace(/['"]?\s*\b(?:alt|src|title|style|class|loading|width|height|srcset|sizes|role|aria-\w+|data-[\w-]+)\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, ' ')
    .replace(/\b(?:loading|decoding)\s*=\s*\w+/gi, ' ')
    .replace(/["']?\s*>/g, ' ');
  return unesc(s).replace(/\s+/g, ' ').trim();
}

/* Split on a tag with a given class, returning each element's full outer HTML.
   Depth-counts <div> so nested divs do not truncate an element early. */
function blocks(html, className) {
  const out = [];
  const re = new RegExp(`<div[^>]*\\bclass=(?:"[^"]*\\b${className}\\b[^"]*"|${className}\\b)[^>]*>`, 'gi');
  let m;
  while ((m = re.exec(html))) {
    let i = m.index + m[0].length, depth = 1;
    const tag = /<\/?div\b/gi;
    tag.lastIndex = i;
    let t;
    while (depth > 0 && (t = tag.exec(html))) {
      depth += t[0][1] === '/' ? -1 : 1;
      // advance past the tag's closing '>' — lastIndex stops after "</div", so using
      // it directly leaves a dangling "</div" inside the extracted block
      const gt = html.indexOf('>', tag.lastIndex);
      i = gt === -1 ? tag.lastIndex : gt + 1;
      tag.lastIndex = i;
    }
    out.push(html.slice(m.index, i));
  }
  return out;
}

const QTYPES = ['multiple_choice_question', 'true_false_question', 'multiple_answers_question',
  'matching_question', 'fill_in_multiple_blanks_question', 'short_answer_question',
  'essay_question', 'numerical_question', 'multiple_dropdowns_question', 'text_only_question'];

function parseQuiz(file) {
  const raw = fs.readFileSync(file);
  const html = raw.toString('utf8');
  const sha256 = crypto.createHash('sha256').update(raw).digest('hex');
  const title = textOf((html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || [])[1] || '') || path.basename(file);

  const questions = [];
  for (const q of blocks(html, 'display_question')) {
    const cls = (q.match(/class=["']?([^"'>]*)/) || [])[1] || '';
    const type = QTYPES.find(t => cls.includes(t)) || 'unknown';
    const name = textOf((q.match(/<span[^>]*\bquestion_name\b[^>]*>([\s\S]*?)<\/span>/i) || [])[1] || '');
    /* Take the question_text div by depth-matching it, rather than "everything up to
       something that looks like the answers block" — that heuristic truncated a
       true/false question to the single character "<". */
    const qtextHtml = blocks(q, 'question_text')[0] ?? '';
    const qtext = textOf(qtextHtml);
    const pts = (q.match(/<span[^>]*\bquestion_points\b[^>]*>\s*\/\s*([\d.]+)/i) || [])[1] || null;

    const answers = [];
    for (const a of blocks(q, 'answer')) {
      if (/\banswer_match_right\b/.test(a) && !/\bid=answer_/.test(a)) continue; // right-hand render-only block
      const weight = (a.match(/<span[^>]*\banswer_weight\b[^>]*>\s*([\d.]+)\s*<\/span>/i) || [])[1] ?? null;
      /* Canvas emits BOTH quoted and unquoted title attributes — dropdown distractors
         come through as `title=Atelectasis.` with no quotes, and a quoted-only pattern
         silently drops every distractor, leaving a cloze card with no wrong options. */
      const titleAttr = unesc(
        (a.match(/\stitle="([^"]*)"/i) || a.match(/\stitle=([^\s">]+)/i) || [])[1] || ''
      );
      const left = textOf((a.match(/<div[^>]*\banswer_match_left\b[^>]*>([\s\S]*?)<\/div>/i) || [])[1] || '');
      /* Rich-text options live in `answer_html` while `answer_text` is present but
         EMPTY and display:none. Reading only answer_text silently produced blank
         options, which showed up as questions being dropped rather than as an error. */
      const atext = textOf((a.match(/<div[^>]*\banswer_text\b[^>]*>([\s\S]*?)<\/div>/i) || [])[1] || '')
        || textOf((a.match(/<div[^>]*\banswer_html\b[^>]*>([\s\S]*?)<\/div>/i) || [])[1] || '');
      const blank = textOf((a.match(/<div[^>]*\bselect_answer\b[^>]*>([\s\S]*?)<\/div>/i) || [])[1] || '');
      const correctClass = /\bclass=["']?[^"'>]*\bcorrect_answer\b/.test(a);
      answers.push({ weight, titleAttr, left, text: atext, blank, correctClass });
    }

    /* ---- key extraction, per question type ---- */
    let key = null, keyWhy = null;
    if (type === 'matching_question') {
      const pairs = answers
        .map(a => {
          const m = a.titleAttr.match(/correct answer was (.+?)\.?$/i);
          return m && a.left ? { left: a.left, right: m[1] } : null;
        })
        .filter(Boolean);
      if (pairs.length) key = { kind: 'pairs', pairs };
      else keyWhy = 'no "correct answer was" title on any option';
    } else if (type === 'multiple_dropdowns_question' || type === 'fill_in_multiple_blanks_question') {
      /* Each blank is an `answer_group`; every option inside it carries its text in a
         `title` attribute, and the correct one additionally has class `correct_answer`
         and weight 100. Options must be collected per group or a cloze card ends up
         with a correct answer and no distractors. */
      const blanks = [];
      for (const grp of blocks(q, 'answer_group')) {
        const heading = textOf((grp.match(/<b[^>]*answer-group-heading[^>]*>([\s\S]*?)<\/b>/i) || [])[1] || '');
        const opts = [];
        let correct = null;
        for (const a of blocks(grp, 'answer')) {
          const t = unesc((a.match(/\stitle="([^"]*)"/i) || a.match(/\stitle=([^\s">]+)/i) || [])[1] || '');
          if (!t) continue;
          const name = t.replace(/\.?\s*(This was the correct answer|You selected.*)\.?$/i, '').replace(/\.$/, '').trim();
          if (!name || opts.includes(name)) continue;
          opts.push(name);
          if (/\bcorrect_answer\b/.test(a.match(/class=["']?([^"'>]*)/)?.[1] ?? '')) correct = name;
        }
        if (opts.length) blanks.push({ label: heading || null, options: opts, correct });
      }
      if (blanks.length && blanks.every(b => b.correct)) key = { kind: 'blanks', blanks };
      else if (blanks.length) { key = { kind: 'blanks', blanks }; keyWhy = `${blanks.filter(b => !b.correct).length} blank(s) have no marked correct option`; }
      else keyWhy = 'no answer_group blocks found';
    } else if (type === 'essay_question') {
      keyWhy = 'essay — Canvas holds no key (self-marked)';
    } else {
      const correct = answers.filter(a => a.weight === '100' || a.correctClass).map(a => a.text || a.left);
      if (correct.length) key = { kind: 'options', correct };
      else keyWhy = 'no option carried weight 100 or class correct_answer';
    }

    questions.push({
      n: name, type, points: pts ? +pts : null,
      q: qtext,
      options: answers.filter(a => a.text && !a.left).map(a => a.text),
      answers: answers.map(({ weight, left, text, blank, correctClass }) => ({ weight, left, text, blank, correctClass })),
      key, keyWhy,
      images: [...qtext.matchAll(/\[\[IMG:([0-9a-f]{16})\]\]/g)].map(m => m[1]),
    });
  }
  return { file: path.relative(EXPORT, file).replace(/\\/g, '/'), title, sha256, questions };
}

/* ── walk the captures ─────────────────────────────────────────────────────── */
const captures = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.html?$/i.test(e.name)) captures.push(p);
  }
})(EXPORT);

/* ── de-duplicate by CONTENT, and keep the RICHEST copy, not the first one ─────
   The same quiz gets captured more than once — three export runs now overlap in
   `_inbox`, and a quiz re-taken to expose its answer key is deliberately a second
   capture of the same questions. Both land here with an identical fingerprint,
   because the fingerprint is the title plus the question text and neither changes
   when you submit an attempt.

   This used to keep whichever file `captures.sort()` reached first, which is a
   filename comparison and therefore meaningless. It cost real work: an export run
   unpacked to `HS2_MERGED/...` sorts ahead of a top-level filename, so five freshly
   captured, SUBMITTED quizzes were discarded in favour of 5 August copies saved
   before submission — including all three essay quizzes and Practice Lab 2, whose
   whole reason for being re-captured was that the first copy had no keys. The parser
   reported "11 Q, 0 keyed" both times and looked entirely healthy doing it.

   Canvas only reveals the key once an attempt is submitted, so between two captures
   of one quiz the one with more recovered keys is strictly the better evidence.
   Rank on that, then on questions recovered, then on how much answer structure
   survived; `file` last so the result is deterministic rather than filesystem-order.
   The losers stay in `dupes` WITH their score, so a wrong pick is visible in the
   artifact instead of having to be re-derived from the filenames. */
const score = p => [
  p.questions.filter(q => q.key != null).length,
  p.questions.length,
  p.questions.reduce((n, q) => n + (q.answers || []).filter(a => a.weight != null || a.correctClass).length, 0),
];
const better = (a, b) => {                       // is a strictly better than b?
  const [x, y] = [score(a), score(b)];
  for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return x[i] > y[i];
  return a.file < b.file;
};

const dupes = [];
const best = new Map();                          // fingerprint -> parsed
const order = [];                                // fingerprints, first-seen order
for (const f of captures.sort()) {
  const parsed = parseQuiz(f);
  if (!parsed.questions.length) { dupes.push({ file: parsed.file, why: 'no display_question blocks — not a quiz results page' }); continue; }
  const fingerprint = crypto.createHash('sha1')
    .update(parsed.title + '|' + parsed.questions.map(q => q.q).join('|')).digest('hex');
  const held = best.get(fingerprint);
  if (!held) { best.set(fingerprint, parsed); order.push(fingerprint); continue; }
  const [win, lose] = better(parsed, held) ? [parsed, held] : [held, parsed];
  best.set(fingerprint, win);
  const [k, n] = score(lose);
  dupes.push({ file: lose.file, sameAs: win.file, droppedScore: `${k} keyed of ${n}`, keptScore: `${score(win)[0]} keyed of ${score(win)[1]}` });
}
const quizzes = order.map(fp => best.get(fp));

fs.writeFileSync(path.join(HERE, 'questions.json'), JSON.stringify({ quizzes, dupes }, null, 1));
fs.writeFileSync(path.join(HERE, 'question-images.json'), JSON.stringify(Object.fromEntries(IMAGES)));

/* ── report ────────────────────────────────────────────────────────────────── */
const all = quizzes.flatMap(q => q.questions);
const keyed = all.filter(q => q.key);
const byType = {};
for (const q of all) (byType[q.type] ??= { n: 0, keyed: 0 }).n++;
for (const q of keyed) byType[q.type].keyed++;

console.log('── QUIZ CAPTURES ──────────────────────────────────');
console.log(`  ${quizzes.length} unique quizzes  ·  ${dupes.length} duplicate/non-quiz files ignored`);
for (const z of quizzes) {
  const k = z.questions.filter(q => q.key).length;
  console.log(`   ${String(z.questions.length).padStart(3)} Q  ${String(k).padStart(3)} keyed   ${z.title.slice(0, 62)}`);
}
console.log('── TOTALS ─────────────────────────────────────────');
console.log(`  ${all.length} questions  ·  ${keyed.length} with an extracted key (${Math.round(100 * keyed.length / all.length)}%)`);
console.log(`  ${IMAGES.size} unique inline images extracted`);
console.log('── BY TYPE ────────────────────────────────────────');
for (const [t, v] of Object.entries(byType).sort((a, b) => b[1].n - a[1].n)) {
  console.log(`  ${String(v.n).padStart(4)}  ${t.padEnd(34)} keyed ${v.keyed}`);
}
const unkeyedNonEssay = all.filter(q => !q.key && q.type !== 'essay_question');
console.log(`\n  ${unkeyedNonEssay.length} non-essay question(s) without a key:`);
for (const q of unkeyedNonEssay) console.log(`     [${q.type}] ${q.q.slice(0, 70)} — ${q.keyWhy}`);
console.log('\nwrote audit/questions.json, question-images.json');
