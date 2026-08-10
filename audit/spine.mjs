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
