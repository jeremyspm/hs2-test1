/* Card schema: tiers, evidence, and the question types that may ship.
   Shared by validate.mjs and the Phase 3 harvester so both agree by construction. */

export const TIERS = {
  /* Her question and her key, extracted from a Canvas capture or the model-answer
     deck. Text is not editable — a diff against the capture proves it. */
  verbatim: { ships: true, inExamSim: true, badge: '📄', label: 'Her question' },

  /* A claim pinned to a specific location in her material by a quote the build greps
     out of corpus.json. */
  taught: { ships: true, inExamSim: true, badge: '📘', label: 'From her slides' },

  /* Standard A&P she never stated. Ships, but badged, and scored separately so the
     exam-sim number means "ready for HER paper". */
  textbook: { ships: true, inExamSim: 'separate', badge: '⚠️', label: 'Not in her material' },

  /* Cites a source that is not on disk — currently the 20 references to the missing
     "MODULE 1 Formative Test (Canvas)" archive. Visible, and out of the sim. */
  unverified: { ships: true, inExamSim: false, badge: '⛔', label: 'Source missing' },

  /* A chain ported from hs2-module1: a named sequence of beads joined by verbs, not a
     question. It is pinned by `from` — the hs2-module1 relation set it was built out of
     — rather than by `ev`, because there is no question and no key to diff against a
     capture. Out of the exam sim, and it carries no `crit`, so it can never make a thin
     focus point look covered. G1 enforces `from`; see build.mjs for why they are
     appended after the coverage maths. */
  rail: { ships: true, inExamSim: false, badge: '⛓', label: 'Ported chain' },
};

/* Question types observed across her 18 captured quizzes and named in the Assessment
   Overview ("Multichoice (MC), Drop-down, True/False and Matching … as well as SAQ").
   `order` is deliberately absent: no ordering question exists anywhere in this course,
   so it may not enter the exam sim. It remains legal in Learn/Drill. */
export const SIM_TYPES = ['mcq', 'cloze', 'match', 'tfset', 'saq', 'flash'];
/* `rail` joined `order` here when the 46 ported chains shipped. It is a study object,
   not a question type — it has no stem, no options and no key — so it must never enter
   the exam sim, but it is legal in the pack and the validator has to know that. Adding
   it is not a relaxation: it moves rails from "46 unknown card types" (a message that
   said nothing and buried the one real G11 failure underneath it) to a declared type
   with its own tier rule in G1. */
export const LEARN_ONLY_TYPES = ['order', 'rail'];
export const ALL_TYPES = [...SIM_TYPES, ...LEARN_ONLY_TYPES];

/* Sources of these authorities may not back a `taught` claim: students are wrong on
   discussion boards, and the pack must not launder that into fact. */
export const WEAK_AUTHORITIES = ['student-peer', 'external'];

export const COVERAGE = { min: 6, blindMin: 10, blindNeedsSaq: true };

/* Minimal normalisation for quote matching — whitespace and dash/space variants only.
   Anything looser and the check quietly stops checking. */
export const normQuote = (s) => String(s)
  .replace(/[‐-―−]/g, '-')
  .replace(/[  ]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

/* Every user-visible string on a card. Walks the object rather than naming fields, so
   a new field cannot smuggle an unchecked claim past the validator. `ev` and `src` are
   metadata, not claims, and are excluded. */
export function claimText(node, out = []) {
  if (typeof node === 'string') out.push(node);
  else if (Array.isArray(node)) node.forEach(n => claimText(n, out));
  else if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) {
      if (k === 'ev' || k === 'src' || k === 'tier') continue;
      claimText(v, out);
    }
  }
  return out;
}
