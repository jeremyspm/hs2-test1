/* THE CARD KEY — a card's identity, and the one hash the whole pipeline agrees on.

   `ckey` is type + question + a signature of the card's own content. It is what the
   dedupe merges on, what the authored overlays key on, what `PACK.spine` names, and what
   the engine keys a reader's progress by. That last one is why it is written out twice
   and cannot be written out once: the engine ships as a single offline page and imports
   nothing. `audit/ckey-fixture.json` exists to hold the two copies to each other.

   Extracted here 11 Aug 2026 because a third copy was about to appear in build.mjs's
   spine gate. Three implementations of a hash whose entire job is to be identical is
   how a stale-key check starts reporting every key as stale while looking plausible.

   EDITING A CARD'S QUESTION OR CONTENT CHANGES ITS KEY, on purpose: a stale explanation
   cannot silently reattach to a card it was not written for, and a reader's progress on
   a question that has been rewritten does not carry over to what is now a different
   question. */
export const strip = (s) => String(s ?? '').replace(/<[^>]+>/g, '');

export const hash = (s) => {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return 'k' + (h >>> 0).toString(36);
};

export const csig = (c) => strip([c.a, c.text, (c.options ?? []).join('~'),
  (c.statements ?? []).map((s) => s.s).join('~'),
  (c.pairs ?? []).map((p) => p.join('>')).join('~'),
  (c.steps ?? []).join('~'), (c.points ?? []).join('~')]
  .filter(Boolean).join('|'));

export const ckey = (c) => hash(c.type + '|' + strip(c.q) + '|' + csig(c));
