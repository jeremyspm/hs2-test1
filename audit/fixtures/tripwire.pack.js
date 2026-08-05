/* A pack engineered to trip EVERY gate exactly once.
   validate-selftest.mjs runs the validator against this and asserts each gate fires.
   A gate that stops working — because a field was renamed, a table entry removed, or a
   regex silently stopped matching — shows up here as a missing failure rather than as
   a clean build. Three real silent no-ops during Phase 2 are why this file exists.

   Each card names the gate it is designed to trip. Do not "fix" them. */
const PACK = {
  id: 'tripwire',
  title: 'Gate tripwire fixture',
  exam: { auto: 30, saq: 5, minutes: 65, pass: 65, mix: { mcq: .5, order: .5 } }, // G6
  topics: [{ id: 't', name: 'T', icon: '🧪' }],
  coverage: { min: 6, blindMin: 10, blindNeedsSaq: true },
  criteria: [
    { id: 'c-floor' },                 // G9: no cards at all
    { id: 'c-blind', blind: true },    // G9: blind, under floor, no SAQ
    { id: 'c-textbook-only' },         // G10: only textbook cards
  ],
  cards: [
    // G1 — no tier
    { type: 'flash', topic: 't', crit: 'c-ok', q: 'G1a: card with no tier', a: 'x' },
    // G1 — unknown tier
    { type: 'flash', topic: 't', crit: 'c-ok', tier: 'made-up', q: 'G1b: bogus tier', a: 'x' },
    // G1 — textbook with no reason
    { type: 'flash', topic: 't', crit: 'c-ok', tier: 'textbook', q: 'G1c: textbook, no srcNote', a: 'x' },
    // G1 — taught with no evidence
    { type: 'flash', topic: 't', crit: 'c-ok', tier: 'taught', q: 'G1d: taught, no ev', a: 'x' },
    /* G1 — `why` holding the sourcing note instead of the explanation. This is the
       failure that silently overwrote ~97 authored explanations: the generator filed the
       tier reason in `why`, so a reader who got the card wrong was told "no citation"
       instead of being taught the answer. The rule went in without a tripwire. */
    { type: 'mcq', topic: 't', crit: 'c-ok', tier: 'textbook', q: 'G1e: why duplicates srcNote',
      options: ['a', 'b'], correct: 0, srcNote: 'no citation — background reading', why: 'no citation — background reading' },
    // G2 — unknown source id
    { type: 'flash', topic: 't', crit: 'c-ok', tier: 'taught', q: 'G2a: bad source', a: 'x',
      ev: [{ src: 'SRC-DOES-NOT-EXIST', loc: 'slide 1', quote: 'anything' }] },
    // G3 — real source, location that does not exist
    { type: 'flash', topic: 't', crit: 'c-ok', tier: 'taught', q: 'G3a: bad location', a: 'x',
      ev: [{ src: 'SRC-2026-RESP2', loc: 'slide 9999', quote: 'anything' }] },
    // G3 — real location, quote not present there
    { type: 'flash', topic: 't', crit: 'c-ok', tier: 'taught', q: 'G3b: quote absent', a: 'x',
      ev: [{ src: 'SRC-2026-RESP2', loc: 'slide 4', quote: 'this string is not on that slide' }] },
    // G4 — taught card asserting a quantity no quote covers
    { type: 'flash', topic: 't', crit: 'c-ok', tier: 'taught',
      q: 'G4a: uncited number', a: 'The value is 12345 mL, which no quote supports.',
      ev: [{ src: 'SRC-2026-RESP2', loc: 'slide 4', quote: '159.6 mm Hg' }] },
    // G5 — rejected value (her slide says 0.2)
    { type: 'flash', topic: 't', crit: 'c-ok', tier: 'textbook', why: 'tripwire',
      q: 'G5a: atmospheric PCO₂', a: 'Atmospheric air has a PCO₂ of 0.3 mmHg.' },
    // G5 — needsHers: 159 without her 159.6
    { type: 'flash', topic: 't', crit: 'c-ok', tier: 'textbook', why: 'tripwire',
      q: 'G5b: atmospheric PO₂', a: 'Atmospheric PO₂ at sea level is 159 mmHg.' },
    // G5 — requireRange: a µm thickness without her full range
    { type: 'flash', topic: 't', crit: 'c-ok', tier: 'textbook', why: 'tripwire',
      q: 'G5c: membrane thickness', a: 'The respiratory membrane is 1 µm thick.' },
    // G5 — notTaught concept given a figure on a non-textbook card
    { type: 'flash', topic: 't', crit: 'c-ok', tier: 'taught',
      q: 'G5d: dead space', a: 'The anatomical dead space is 150 mL.',
      ev: [{ src: 'SRC-2026-RESP2', loc: 'slide 19', quote: 'Normally about 500ml of air is moved in & out per breath' }] },
    // G6 — card type that does not exist
    { type: 'nonsense', topic: 't', crit: 'c-ok', tier: 'textbook', why: 'tripwire', q: 'G6a: bad type', a: 'x' },
    // G7 — taught backed only by a student discussion board
    { type: 'flash', topic: 't', crit: 'c-ok', tier: 'taught', q: 'G7a: weak authority', a: 'x',
      ev: [{ src: 'SRC-DISCUSSION-MODULE-1-2-RESPIRATORY-SYSTEM-DISCU', loc: 'line 289', quote: '23% is carried as Carbaminohemoglobin' }] },
    // G8 — a written card disagreeing with a verbatim one on the same criterion.
    // Both values must be ones the declared table knows for this concept, because G8
    // only compares numbers it can attribute; an undeclared value is not identifiable
    // as this quantity and is left to G4/G5 instead.
    { type: 'mcq', topic: 't', crit: 'c-clash', tier: 'verbatim',
      q: 'G8 anchor: atmospheric PO₂ at sea level?', options: ['159.6 mmHg'], correct: 0,
      a: 'Atmospheric PO₂ at sea level is 159.6 mmHg.',
      ev: [{ quiz: 'tripwire quiz', capture: 'n/a', captureSha: 'deadbeef', n: 'Question 1' }] },
    { type: 'flash', topic: 't', crit: 'c-clash', tier: 'textbook', why: 'tripwire',
      q: 'G8a: contradicts her key', a: 'Atmospheric PO₂ at sea level is 159 mmHg.' },
    // G11 — stem promises a figure the card does not have
    { type: 'mcq', topic: 't', crit: 'c-ok', tier: 'textbook', why: 'tripwire',
      q: 'G11a: The structure labelled B is the', options: ['aorta', 'vena cava'], correct: 0 },
    // G11 — an unresolved image marker survived into the card text
    { type: 'flash', topic: 't', crit: 'c-ok', tier: 'textbook', why: 'tripwire',
      q: 'G11b: leftover marker [[IMG]]', a: 'x' },
    // G11 — explicitly held by the binder
    { type: 'flash', topic: 't', crit: 'c-ok', tier: 'textbook', why: 'tripwire',
      q: 'G11c: held card', a: 'x', figHold: 'dependent',
      figMissing: 'the stem cannot be answered without a figure the pack does not have' },
    // G10 — a criterion covered only by textbook cards
    { type: 'flash', topic: 't', crit: 'c-textbook-only', tier: 'textbook', why: 'tripwire',
      q: 'G10a: textbook-only criterion', a: 'x' },
  ],
  glossary: [],
};
