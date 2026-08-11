/* WHICH CARD LEADS A FOCUS POINT — one implementation, three consumers.

   §4 of ../HS2-CRAM-REBUILD-SPEC.md: "One card per focus point, chosen as the
   best-evidenced card for that point." Ring 0 deals exactly these 38 cards, Progress
   shows them, and measure-spec.mjs prints them for review. If any of those computed the
   choice for itself, the deck a reader is dealt would stop being the deck that was
   reviewed, and nothing would show it — the review is a human reading 38 cards, and it
   only means anything if the tool leads with the same 38.

   The engine cannot import this file (it ships as one offline page), so the resolved
   choice is BAKED INTO THE PACK by apply-migration.mjs as `PACK.spine` — criterion id to
   the card's `ckey` — and build.mjs refuses to ship a spine entry that resolves to no
   card. The engine looks up, it does not choose.

   THE ORDER OF THE TIE-BREAKS IS THE WHOLE RULE, and it has already been wrong once.
   Written as §4's sentence reads — repeat first, then tier — it puts a `taught` card
   that happens to carry two evidence entries at the head of resp-14, ahead of sixteen of
   Hannetjie's own questions. "Asked more than once" is a tie-break BETWEEN her questions,
   never a reason to prefer a slide over one. */

/* Only cards whose PRIMARY subject the point is are eligible. An `alsoCrit` mention is a
   card about something else, which is the whole of C2 in that spec — and six focus points
   were being led by one before the 11 Aug pass. */
const RANK = { verbatim: 3, taught: 2, textbook: 1 };
const evsOf = (c) => [].concat(c.ev ?? []).filter(Boolean);
export const partsOf = (c) =>
  (c.blanks?.length || c.pairs?.length || c.statements?.length || c.points?.length || c.steps?.length || 1);

/** The spine card for one criterion, or null if nothing is primarily about it. */
export function spineFor(cards, critId) {
  const mine = cards.filter((c) => c.crit === critId && c.type !== 'rail');
  return mine.slice().sort((a, b) =>
    (RANK[b.tier] ?? 0) - (RANK[a.tier] ?? 0) ||          // her question, else her lecture, else ours
    (evsOf(b).length > 1) - (evsOf(a).length > 1) ||      // set twice beats set once
    partsOf(b) - partsOf(a)                              // more of the point tested
  )[0] ?? null;
}

/** [{ id, card }] for every criterion the pack declares, in published order. */
export function spineOf(pack) {
  return (pack.criteria ?? []).map((cr) => ({ id: cr.id, card: spineFor(pack.cards ?? [], cr.id) }));
}

/* ── which ring a card is dealt in ────────────────────────────────────────────
   The engine carries its own copy of this — it ships as one offline page and imports
   nothing — so build.mjs runs BOTH and fails if the four counts disagree. That gate is
   the only thing making "Ring 1 holds 14 cards" mean the same in the spec and in the
   reader's hands.

   THINAT is the "fewer than six cards" of §4, counted over `crit` AND `alsoCrit`,
   because a point is thin when little TOUCHES it, not when little leads it. */
export const THINAT = 6;

export function ringsOf(pack) {
  const cards = (pack.cards ?? []).filter((c) => c.type !== 'rail' ? true : true);
  const per = {};
  for (const c of cards) {
    if (c.type === 'rail') continue;
    for (const id of [c.crit, ...(c.alsoCrit ?? [])].filter(Boolean)) per[id] = (per[id] ?? 0) + 1;
  }
  const spineKeys = new Set(Object.values(pack.spine ?? {}));
  const ckeyOf = new Map();   // filled by the caller's ckey, kept out of here on purpose
  return { per, spineKeys, ckeyOf };
}

/* THE WRITTEN HALF — mirrors the engine's `onWritten`/R_* constants exactly. The two
   copies exist because the engine ships as one offline page and imports nothing; G15
   runs both and fails if the counts disagree, which is the only thing making
   "Round 2 holds 21 cards" mean the same in the spec and in the reader's hands. */
export const writtenOf = (pack) => new Set((pack.written ?? []).filter(Boolean));
export const onWritten = (c, wset) =>
  [c.crit, ...(c.alsoCrit ?? [])].filter(Boolean).some((id) => wset.has(id));

/** 0-4 for one card. `isSpine` is passed in because the key hash lives in ckey.mjs. */
export function ringOfCard(c, per, isSpine, wset) {
  const W = wset && wset.size > 0;
  const R_WRITTEN = W ? 1 : -1, R_THIN = W ? 2 : 1, R_REST = W ? 3 : 2, R_BG = W ? 4 : 3;
  if (isSpine) return 0;
  /* Before the thin test, exactly as the engine does it. */
  if (R_WRITTEN >= 0 && onWritten(c, wset)) return R_WRITTEN;
  if ([c.crit, ...(c.alsoCrit ?? [])].filter(Boolean).some((id) => (per[id] ?? 0) < THINAT)) return R_THIN;
  return c.tier === 'verbatim' ? R_REST : R_BG;
}

/** [n0, n1, n2, n3] over every card the engine would consider dealing. */
export function ringCounts(pack, ckey) {
  const { per, spineKeys } = ringsOf(pack);
  const wset = writtenOf(pack);
  /* Length follows the pack, so a pack with no written half still reports four rings and
     a hardcoded [0,0,0,0] cannot silently drop the fifth on the floor. */
  const out = new Array(wset.size > 0 ? 5 : 4).fill(0);
  for (const c of pack.cards ?? []) {
    if (c.damaged) continue;                       // the engine's `answerable` filter
    out[ringOfCard(c, per, spineKeys.has(ckey(c)), wset)]++;
  }
  return out;
}
