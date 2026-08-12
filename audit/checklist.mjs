/* THE COURSE'S OWN CHECKLIST, READ OUT OF THE CORPUS ─────────────────────────────
   The Canvas page "Module 1: Learning checklist" is byte-identical to the document
   this pack was already built from: `SRC-ASSESSMENT-CRITERIA`, the extracted text of
   ASSESSMENT CRITERIA.docx, headed "Continuous Tests and Exam Focus Points". Diffed
   line by line, Module 1 block: 45 of 45 identical whitespace-normalised, typos and
   all ("the sounds the heat makes", "it's control", the unclosed bracket in
   Respiratory 5, Myocardial Infarction listed twice in the CVS terms).

   So putting the course's wording on screen is not adopting a new source. It is
   stopping the paraphrase of one we already ship — and the strings are therefore
   GENERATED HERE, never typed into pack.js ([[porting-not-reimplementing]]: copy it
   byte for byte and enforce with a diff check; a prose spec always drifts).

   NOTHING IS REPAIRED ON THE WAY THROUGH. A silently corrected line is a line the
   reader cannot find when they hold this page beside their own Canvas tab, which is
   the entire point of showing it. The pack's own paraphrases (`criteria[].name`) stay
   as the short label for tight places; they stop being the thing a reader is asked to
   recognise. [[verbatim-is-provenance-not-immutability]] applied to the criteria.

   Every structural surprise THROWS. If the document changes shape — a system renamed,
   a criterion renumbered, a sub-point promoted — this must fail the build loudly rather
   than emit 34 rows and let a reader discover the other two are missing during a test. */
import { readFileSync } from 'node:fs';

export const SRC = 'SRC-ASSESSMENT-CRITERIA';

/* One system heading per body system, in the order the document prints them. The pack's
   own `systems` list uses short ids; the join between the two is the authored map in
   checklist-map.json, never a prefix guess. */
const SYSHEAD = /^(Cardiovascular|Respiratory|Lymphatic) System$/;
const SYSCODE = { Cardiovascular: 'CVS', Respiratory: 'RESP', Lymphatic: 'LYMPH' };
/* "5." starts a criterion; "5.1" is a sub-line OF criterion 5. The distinction is the
   whitespace after the dot, and it matters: splitting 5.1/5.2/5.3 into rows of their own
   would take the criteria count 38 → 41 and invalidate every saved lock on the biggest
   focus point in the pack. */
const ITEM = /^(\d+)\.\s+(\S[\s\S]*)$/;
const SUB  = /^(\d+)\.(\d+)\s+(\S[\s\S]*)$/;
/* The three terminology rows. Matched on the phrase the document actually uses for
   them, NOT on "such as" — Respiratory 7 says "such as airway resistance, surface
   tension…" and is a statement about mechanics, not a list of terms to define. */
const TERMSROW = /\bterms\b[\s\S]*\bhomeostatic imbalances\b/i;

export const ws = (s) => String(s).replace(/\s+/g, ' ').trim();
/* Case, curly apostrophes and trailing full stops folded — and nothing else. The course
   writes "Boyle’s Law" and the glossary "Boyle's law"; treating those as different terms
   would report a covered term as a gap, which is the fake-confident failure
   [[self-explaining-ui-policy]] forbids. Anything beyond this is a real difference and
   belongs in the authored alias table, where a human has looked at it. */
export const normTerm = (s) => ws(s).replace(/[’‘]/g, "'").replace(/\.+$/, '').toLowerCase();

export function readChecklist(corpusPath) {
  const corpus = JSON.parse(readFileSync(corpusPath, 'utf8'));
  const units = corpus.filter((u) => u.src === SRC).map((u) => ({ ...u, t: String(u.t ?? '') }));
  if (!units.length) throw new Error(`${SRC} is not in the corpus — the checklist has no source`);

  const from = units.findIndex((u) => /^Module\s*1\s*:?\s*Assessment Criteria$/i.test(ws(u.t)));
  if (from < 0) throw new Error(`${SRC} has no "Module 1: Assessment Criteria" heading`);
  const rest = units.slice(from + 1);
  const to = rest.findIndex((u) => /^Module\s*2\b/i.test(ws(u.t)));
  if (to < 0) throw new Error(`${SRC} never reaches Module 2 — cannot tell where Module 1 ends`);
  const block = rest.slice(0, to);

  const systems = [];
  let sys = null, item = null;
  for (const u of block) {
    const t = ws(u.t);
    if (!t) continue;
    const head = t.match(SYSHEAD);
    if (head) {
      sys = { code: SYSCODE[head[1]], name: t, items: [] };
      systems.push(sys);
      item = null;
      continue;
    }
    if (!sys) throw new Error(`checklist line before any system heading: "${t.slice(0, 60)}"`);
    const sub = t.match(SUB);
    if (sub) {
      if (!item) throw new Error(`sub-point "${t.slice(0, 40)}" with no criterion above it`);
      if (+sub[1] !== item.num) throw new Error(`sub-point ${sub[1]}.${sub[2]} sits under criterion ${item.num}`);
      item.subs.push({ n: `${sub[1]}.${sub[2]}`, text: sub[3] });
      continue;
    }
    const it = t.match(ITEM);
    if (it) {
      item = { sys: sys.code, num: +it[1], text: it[2], subs: [], termsLine: null };
      if (item.num !== sys.items.length + 1)
        throw new Error(`${sys.code} jumps from ${sys.items.length} to ${item.num} — the list is not consecutive`);
      sys.items.push(item);
      continue;
    }
    /* Anything else continues the criterion above it. In this document that is only ever
       the term list under CVS 15 and Respiratory 17, both of which end their own line
       with a colon. Assert that rather than accept any stray paragraph as data. */
    if (!item) throw new Error(`orphan checklist line: "${t.slice(0, 60)}"`);
    if (item.termsLine) throw new Error(`${item.sys} ${item.num} has two continuation lines`);
    if (!/:$/.test(item.text)) throw new Error(`${item.sys} ${item.num} gained a continuation line but does not end in a colon: "${t.slice(0, 60)}"`);
    item.termsLine = t;
  }

  const items = systems.flatMap((s) => s.items);
  for (const it of items) {
    if (!TERMSROW.test(it.text)) {
      if (it.termsLine) throw new Error(`${it.sys} ${it.num} carries a term list but does not read as a terminology row`);
      it.terms = null;
      continue;
    }
    /* Terms come from the continuation line where there is one, and otherwise from the
       tail of the sentence itself — Lymphatic 4 prints its nine inline. */
    const raw = it.termsLine ?? (it.text.split(/\bsuch as\s+/i).slice(1).join('such as ') || '');
    if (!raw) throw new Error(`${it.sys} ${it.num} reads as a terminology row but lists no terms`);
    it.terms = raw.split(',').map((x) => ws(x)).filter(Boolean);
    if (it.terms.length < 5) throw new Error(`${it.sys} ${it.num} lists only ${it.terms.length} terms — the split has gone wrong`);
  }
  return { systems, items };
}

/* The join between the course's numbering and this pack's criterion ids. Authored, not
   derived: it is a clean 1:1 by position TODAY, and that is an observation rather than a
   contract. Position-derived mapping is precisely how a dead ALIAS pointing at an id in
   no registry survived long enough to demote thirteen of the lecturer's own questions
   with a reason that was not true. Both directions are asserted total. */
export function joinChecklist(items, map, criteria, exclude) {
  const skip = new Set(exclude ?? []);
  const want = criteria.filter((c) => !skip.has(c.id));
  const label = (it) => `${it.sys} ${it.num}`;
  const byLabel = new Map(items.map((it) => [label(it), it]));
  const fails = [], out = [];
  const claimed = new Map();
  for (const c of want) {
    const lab = map[c.id];
    if (!lab) { fails.push(`${c.id} is in the pack and not in checklist-map.json`); continue; }
    const it = byLabel.get(lab);
    if (!it) { fails.push(`${c.id} claims "${lab}", which the course document does not print`); continue; }
    if (claimed.has(lab)) { fails.push(`"${lab}" is claimed by both ${claimed.get(lab)} and ${c.id}`); continue; }
    claimed.set(lab, c.id);
    /* A transposed row is the failure this catches: cvs-9 mapped to RESP 9 would still
       be a total bijection and would still render 36 rows. */
    const pre = String(c.id).split('-')[0].toUpperCase();
    if (pre !== it.sys) fails.push(`${c.id} is mapped to ${lab} — a ${it.sys} row under a ${pre} id`);
    out.push({ ...it, crit: c.id, name: c.name || c.id });
  }
  for (const [lab, it] of byLabel) if (!claimed.has(lab)) fails.push(`the course prints "${lab}" (${it.text.slice(0, 50)}…) and no pack criterion claims it`);
  for (const id of Object.keys(map)) if (!want.some((c) => c.id === id)) fails.push(`checklist-map.json maps ${id}, which is not a criterion of this pack`);
  return { rows: out, fails };
}
