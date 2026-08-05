# HS2 Test 1 Cram — Module 1

Cram tool for **Health Science 2 (722.541) Continuous Test 1** — Module 1:
Cardiovascular, Respiratory, Lymphatic. **23 Aug 2026**, ProctorU, 65 min, 35
questions, 20% SAQ, 16.6% of the final grade.

> **The course publishes no pass mark for this test.** The Assessment Overview
> specifies everything else — duration, conditions, SAQ share, question count,
> weighting, the marking verbs, the week it sits — and states no pass mark anywhere.
> The only pass thresholds in the whole course are the lab hurdles (80% attendance,
> 50% on an online lab quiz standing in for a missed lab). The pack's `exam.pass: 65`
> had been there since the first commit, in the same object as `minutes: 65`, and the
> tool rendered it as *"you need 65% to pass"*. It is now `passIsTarget: true`, so
> every screen calls it **this tool's target** and says the course sets none.

**Live:** https://jeremyspm.github.io/hs2-test1/

## Why this exists in the shape it does

The course publishes `Science 2 Detailed Content.docx`, titled *"Continuous Tests
and Exam Focus Points"* — **36 numbered focus points** for Module 1. That is the
word the tool uses throughout, because it is the word the student's own document
uses. Mapping both formative tests onto it:

| | Drilled | Partial | **Blind** |
|---|---|---|---|
| Cardiovascular (15) | 6 | 8 | 1 |
| Respiratory (17) | 5 | 6 | 5 |
| Lymphatic (4) | 1 | 2 | 1 |
| **36** | **12 (33%)** | 16 (44%) | **7 (19%)** |

**The formative tests directly drill only a third of them.** So the pack is authored
from the focus points, and the formatives are used only to calibrate how each one
gets asked. The eight `blind:true` ones (the seven above plus the Vaccination case
study, which has zero immunology coverage anywhere in the course material) carry a
higher card floor and are oversampled by the mock test. **`blind` renders as "never
practised"** — it means *the course lists this as examinable and no practice test we
can read covers it*, which is the sentence a student needs.

Full gap analysis: [`../HS2-TEST1-CRAM-SPEC.md`](../HS2-TEST1-CRAM-SPEC.md).

## Contents

**586 cards** · 242 flash · 171 mcq · 54 match · 44 saq · 29 tfset · 29 cloze ·
17 order · 74 glossary terms · 15 figures.

Every card carries a `crit:` naming the focus point it covers, and **`node build.mjs`
exits non-zero** if any drops below its floor (6 cards, or 10 plus a written answer
for a never-practised one). The same command also refuses to ship if **any of the 300
machine-marked cards has no explanation, or any of the 44 written answers has no model
answer**. Those gates are what let the page stop warning the reader: validation output
goes to the console and the **Sources** tab, `?dev=1` brings the banner back for
authoring, and a failing pack simply does not build — `index.html` is written last, so
a build that says NOT SHIPPING has not written one.

## Start in the Brief

The **Brief** tab is the study guide: one section per focus point, in the order the
course publishes them, written out as prose. It is generated from the pack's flash
answers — the same content the flip cards use, read as a page instead of as
questions. Each section ends with **▸ Drill this**, which points **Study** at
that focus point alone; get a question wrong and **→ Read the full explanation**
brings you straight back to its section.

Open the tool with no saved progress and it **lands there**, deliberately. Study
opens by asking you to recall something; on a topic you only half-absorbed in the
lecture, that is the slowest and most discouraging way in. Read the section, mark
it read, then drill it.

## Then Study — one queue, 586 cards

There is **one** practice tab. Every card in the pack is in it, and the card decides
how it is presented: a flashcard flips and you grade yourself, a written question
reveals its marking points for you to tick, a multichoice/matching/ordering/cloze/
true-false card is answered and marked for you. The deck works through the course in
its published order — **Cardiovascular → Respiratory → Lymphatic & immunity →
Terminology** — finishing one before starting the next, and inside each block it leads
with the questions Hannetjie has actually set before.

This replaced three tabs (Learn, Drill, Written) that split the pack by how a card
happened to be marked. That split made an honest card count impossible — Drill spoke
for only the 300 machine-marked cards while Sources said 586 — and put all 44 written
questions in two tabs at once.

### 240 by default, 586 on request

The queue holds **240** cards, not 586. The other **346** are background reading:
standard physiology sitting on focus points Hannetjie's own questions already cover.
Only **17** textbook cards are load-bearing — the ones holding up cvs-1, resp-9,
resp-15 and resp-16, the four focus points with no sourced card anywhere — and those
stay in.

Nothing is deleted and nothing is locked. The switch sits above the queue under both
doors and states both counts; the Brief and Search always show everything; the mock
test draws from whichever pool you are studying, so it cannot ask you something the
queue has never shown you; Progress counts that pool and says so. A card is demoted
only if **every** focus point it touches already has a sourced card, and the build
fails if that leaves any focus point with nothing to drill.

Both doors show all 38 focus points — **🎯 Get me ready** only reorders them, leading
with the never-practised ones and whatever you are weakest on. Nothing is hidden
behind either door.

Every fact says where it came from. **📄 From a past quiz** is the rare, valuable one
and gets the strong colour; most of the rest is **background reading** — standard
physiology written for this pack so the examinable facts have something to sit on,
cross-checked against `hs2-module1`. That badge is deliberately grey and silent. It
used to be a red-orange ⚠️ firing on 61% of all cards, which is not a warning, it is
a texture that teaches a reader to distrust the whole tool — and it was never true:
the content is not suspect, it just is not in the slides.

## All cards — read the pack, flag what is broken

Behind the `···`. Every one of the 586 cards, standing still: group them by topic,
focus point, source or question type, open a group and read the questions with their
answers straight through. It shows the background-reading cards too — like the Brief
and Search, this is a view that has to be able to show *everything*.

It exists because the queue is not a way to *read* a pack. Study deals one card and
chooses it for you, Search needs the word you are looking for already, and the Brief
is prose about focus points rather than the cards themselves — so most of these 586
could only be encountered, never inspected.

That matters because **three of the answer keys imported from Hannetjie's own quizzes
were wrong**, and each was caught by a person reading the card. **⚑ Flag** is on every
card here, on the study card, and in the mock-test review (not during the mock test —
mid-question it would be a hint the real paper will not give). Say what is wrong, add
a note, and it is kept on the device; **All cards → ⚑ Flagged** exports the lot.
`node audit/flags.mjs` is the other end of that trip — see *Acting on flagged cards*.

## Build

The shipped `index.html` is a single self-contained offline file. It is generated,
because a 380-card pack is not editable inside one HTML file.

```bash
node audit/apply-migration.mjs --write   # regenerate pack.js from the evidence base
node audit/validate.mjs                  # 11 gates over the evidence
node build.mjs                           # splice into the engine → index.html
```

`pack.js` is **generated** — `audit/apply-migration.mjs` assembles it from
`pack.source.js`, `migration.json`, the harvest, the case studies,
`coverage-fill.js` and `explanations.json`, then runs the voice pass. Do not
hand-edit it. `build.mjs` splices it (plus the figures) into
`../cram-engine/template.html`, reports card counts, and **exits non-zero if any focus
point is under its card floor or any card cannot explain itself**.

**What is in git and what is not** is decided in `.gitignore`, and the rule is that a
fresh clone must be able to run `apply-migration` and `validate`. It cannot run the
whole pipeline, because the source documents live in `../_inbox` and are not part of
this repo — so `audit/harvested-bound.js` (2.1 MB) and `audit/corpus.json` (2.4 MB) are
tracked despite being generated, and the 50 MB of quiz screenshots behind them is not.

```bash
node port-figs.mjs           # re-extract figures from hs2-module1
node port-figs.mjs --check   # fail if they have drifted
```

Figures are copied **byte for byte** from `hs2-module1` — never re-drawn, never
re-described. `--check` is the enforcement. Run it before shipping.

### Acting on flagged cards

The live tool has a **⚑ Flag** button on every card — in **All cards**, on the study
card, and in the mock-test review. It is how a wrong answer key gets reported by the
person best placed to notice one: whoever is reading it. Flags are stored on the
device, keyed by the card's `ckey`, and exported from **All cards → ⚑ Flagged**.

```bash
node audit/flags.mjs audit/flags.json    # resolve the export back to cards
```

It prints each flagged card's question, answer, explanation and source, worst reason
first, then lists any flag whose key no longer resolves — those point at a card that
has since been edited, which usually means it was already fixed. **It is not a build
gate.** A flag is a reader's report, not a schema error.

It does gate itself: it re-derives `ckey` in Node, so before printing anything it
proves its copy of the hash still agrees with `apply-migration.mjs` by checking that
all 178 keys in `explanations.json` resolve. A drifted hash would otherwise report
every flag as stale, and look completely plausible doing it.

Three answer keys in this pack were already wrong when they were imported (see
*Four places where the course material disagrees with itself*). Assume there are more.

## Editing content

Content changes go into the generator's inputs, never into `pack.js`. Cards
reference figures as `F('cvs3-ecg')` and `FC('cvs3-ecg')`; `build.mjs` inlines them.
To add a figure, add its id to `WANTED` in `port-figs.mjs`, re-run it, then use it.

**The voice pass is a whitelist, not a regex sweep** (`apply-migration.mjs`, step 6).
It rewrites 204 third-person references to the lecturer into "Hannetjie's", and it
must never touch the ten that describe *patients* — Kalama choking, La'akea's
punctured pleura, Oliana after exercise, Jill in hypovolaemic shock. Those pronouns
are correct clinical prose. A further 39 matches sit inside `fig`, adjacent to
megabytes of base64: they turned out to be a real `alt` attribute, but a blind pass
over the file would have been one lucky escape from corrupting the images. Every
rule is asserted to fire and the pack is re-scanned afterwards, so a rule that stops
matching fails the build rather than leaking a "she".

Card types beyond flash/mcq/saq — `order`, `cloze`, `tfset`, `match` — are
documented in [`../cram-engine/README.md`](../cram-engine/README.md). They exist
because the real Canvas paper uses them and they carry most of its marks: the
ECG cloze in the formative was worth 6 points and the acidosis cloze 10, against
1 for a typical MCQ.

## Where the content comes from — read this before trusting a number

Be clear about the split:

**Sourced from the Canvas export (verifiable):**
- The **scope** — all 36 focus points, from `Science 2 Detailed Content.docx`.
- The **test format** — 65 min, 35 questions, 20% SAQ, no rough paper, from the
  Assessment Overview page.
- **Which case studies are examinable** — blue = tests, yellow ★ = exam, stated
  outright in `Case Study Workbook 2026 S2.docx`.
- **190 cards are Hannetjie's own questions**, copied unedited from a Canvas
  capture, and **33 more** are pinned to a place in her nine Module 1 decks by a
  quote the build re-greps out of the corpus. Both render an in-app badge you can
  tap for the document and the quote.
- Every marking schedule labelled "verbatim" was copied from the lecturer's own
  model answer in the Canvas formative.

**Not sourced from the lecture material:** the remaining 363 cards are standard
anatomy and physiology written for this pack. They were then cross-checked against
`hs2-module1`, which *was* built from Hannetjie's lecture slides with per-answer
citations. Each carries a `srcNote` saying so.

### `why` explains. `srcNote` sources. They are not the same field.

The generator used to file the sourcing reason in `why` — the field the Drill view
renders as the explanation of a wrong answer. Two consequences, both fixed here:

- **123 drill cards answered *"why was I wrong?"* with *"no citation — standard
  textbook content written for the pack"*.** Worse than a bare mark.
- **Writing to `why` overwrote the authored explanation that was already there.**
  `pack.source.js` has 127 machine-marked cards with a real `why:`; only 31 survived
  into the shipped pack. Splitting the fields recovered them — **128 of 300 drill
  cards now carry an authored explanation, up from 31**, with no new writing.

The remaining 172 have now been authored, in `audit/explanations.json`, along with a
`model:` for the last 6 written answers. **Every machine-marked card in the pack
explains itself, and the build refuses to ship one that does not.**

They live in their own file rather than in the cards because most of them belong to
harvested cards — the lecturer's own questions, reproduced unedited and proven so by a
diff against the capture — and `pack.source.js` is the pre-migration source, which
holds none of them. Each entry is keyed by the **same content hash the deduplication
uses**: edit a question and its key changes, so a stale explanation fails the build
rather than silently reattaching itself to a card it was not written for. The
generator also **refuses to overwrite an explanation that already exists**, which is
the specific failure that cost this pack ~97 authored lines last time.

They are written to sit *on top of* the engine's floor, not to replace it. The floor
already states the correct option or the pairs missed; an authored line gives the
reasoning, names the trap, or separates the two things being confused.

### Duplicates: five culled, both sources kept

Five harvested questions appeared twice — same question, same answer, same focus
point. Not an import bug: Hannetjie had set the same five on *two* lab quizzes
(`MODULE 1.1: SAQ STUDENT MARKED CVS LAB REVIEW` and `Practice Lab 1`). One card
survives and carries **both** `ev` records, so the reader now sees that the question
has been set twice — a stronger signal than either card alone.

### Coverage fill

`cvs-1` (*Function of the cardiovascular system*, never practised) shipped with 6
cards and no written answer against a floor of 10 — and the page announced that
failure to the student in a yellow banner. `audit/coverage-fill.js` adds the four
cards that close it, kept in their own file so it stays obvious which cards exist
because the blueprint demanded them rather than because the evidence base produced
them.

### Corrections that cross-check found

Nine places where the content was wrong or unsupported. All fixed:

| Was | Now | Why |
|---|---|---|
| Atmospheric air 597 / 159 / 0.3 / 3.7 mmHg | **592.8 / 159.6 / 0.2 / 7.4** | Her RESP2 slides 4–5 give her own breakdown. Hers wins. |
| SA node 60–100, Purkinje 20–40 /min | **SA ~70, AV 40–60, bundle of His ~30** | The lecture's own figures. Textbook range noted separately. |
| CO₂ transport 70 / 23 / 7 % | **70 / 20–30 / 7–10 %** | RESP 3 slides 22–23 give ranges, not point values. |
| Respiratory membrane "0.5 µm" | **0.5–1 µm** | RESP2 slides 28–32. |
| "90% reabsorbed, the other 10% = 3 L/day" | **~20 L filtered, ~17 L reabsorbed, ~3 L via lymphatics** | The old wording was arithmetically impossible. |
| Alveolar surface area "70 m²" | number removed | Textbooks say 70–140 m²; her slides give no figure. |
| Starling cloze forced a numeric answer (35/17/25 mmHg) | rewritten to test **which pressure wins where** | She teaches the tug-of-war qualitatively and never gives numbers. |
| Lung volumes SAQ labelled "3 marks" | mark claim removed | The formative scored that question at **1 point**. |
| Artery/vein SAQ asked for "3 and 3" | **"3 you can see, 2 you cannot"** | That is the real question, and her 5th visible point was missing. |
| Alveolar mixing volume "~2200 mL" | **~2400 mL (the FRC)** | Contradicted this pack's own lung-volume card. |
| S1 "louder than S2" | **"longer and lower-pitched"** | Relative loudness depends on the auscultation site. |

### Four places where the course material disagrees with itself, or with the rule

Writing an explanation for all 300 machine-marked cards meant reading every answer key
in the pack against what it claims. Four of them do not survive that reading. A
**verbatim card is never edited** — it reproduces the lecturer's own question *and* her
key, and that fidelity is the whole basis of the tier — so in each case the card ships
unchanged and its explanation says plainly what the disagreement is.

| Card | The key says | The problem |
|---|---|---|
| `MODULE 1.3` ABG: pH 7.52, PaCO₂ 30 mmHg, HCO₃⁻ 24 mmol/L | metabolic alkalosis | pH up, CO₂ down, bicarbonate normal is a **respiratory** alkalosis by the standard rule. Verified against the raw capture (`weight:100`), so this is the source, not the import. The explanation teaches the rule and flags the key. |
| `MODULE 1.1 SHOCK QUIZ`: "Cardiogenic shock can be caused by" | fluid build-up in the pericardial space | **The same quiz's next question files that same cause under obstructive shock.** Both labels are defensible and both are in the course material; the explanation says so rather than picking one. |
| Loop diuretic: which symptoms should the nurse expect | restlessness and agitation | The classic potassium picture — weak irregular pulse, poor muscle tone — is another option on the same card and is also a real effect of the same drug. The explanation gives both. |
| `MODULE 1: FORMATIVE` MALT passage: the blood cell abundant in lymph, and its function | lymphocyte — "primary mediators of the rapid innate host defense against most bacterial and fungal pathogens" | The cell is right, the function belongs to the **neutrophil**. Lymphocytes are the *adaptive* arm: B cells make antibody, T cells kill infected cells. Verified against the raw capture, so again the source and not the import. The explanation flags it and teaches the innate/adaptive split. |

Same rule as everywhere else in this tool: a study aid that quietly teaches a wrong
answer because the answer key said so is worse than one that shows its working.

### One number the pack contradicted itself on

Three cards give the capillary-filtration budget as **20 L filtered / 17 L reabsorbed /
3 L returned by the lymphatics**, and two more rounded that residue to "10%". 3 of 20 is
15%. Nothing in the course states either figure, so the arithmetic the pack already
uses wins: both now say *3 L of the 20 L filtered each day*. Worth knowing that `G5`
does not catch this — it only compares numbers against the **declared** quantity table,
and a percentage nobody declared is invisible to it.

### Focus points chosen by a substring

Every harvested card gets its focus point from `audit/map-criteria.mjs`, a hand-written
table of one regex per criterion, and `crits[0]` becomes the card's displayed focus
point. Three of those regexes matched **inside other words**:

| Rule | Bare alternative | What it really matched |
|---|---|---|
| `cvs-10` General factors affecting HR, SV, CO | `age` | pass**age**, im**age**, cartil**age**, percent**age**, rib c**age**, dam**age** — **47 of its 49 "her questions" were the word "passage"** |
| `cvs-7` Heart sounds | `lub` | so**lub**ility — two gas-solubility questions filed under heart sounds |
| `cvs-5` Functional anatomy of the heart | `chamber` | "hyperbaric **chamber**s" |

Nothing about this was visible in the output: the counts simply came out high and
13 cards displayed the wrong focus point. The rules are now word-bounded, `cvs-10`
reports **2** of her questions rather than 49, and `map-criteria.mjs` runs a control
list first — scaffolding wording like *"Complete the passage."* and the near-misses
above — and **exits non-zero if any rule fires on text that names no physiology**. The
blind list is unchanged by all of this: still `cvs-1`, `resp-15`, `resp-16`.

**Known and not fixed:** the rules match the whole card, *including its distractors*, so
a wrong answer can still choose a card's focus point — that is why three pleura
questions sit under `cvs-5` (the options mention "pericardium") and the hyperbaric
question under `cvs-11` ("Frank-Starling"). About 15 cards are affected. Ranking a
criterion that matches the stem and the correct answer above one that only matches a
distractor is the fix, and it reshuffles enough of the mapping to deserve its own pass.
Two harvested cards name no topic at all in their own wording and carry **no** focus
point rather than a guessed one; that is the table's stated policy, not an oversight.

## Notes

- **`lean:'exam'`** marks content the lecturer flagged as final-exam-only (the
  acidosis→chemoreceptor→phrenic cascade). It stays in Study and is
  excluded from the mock test.
- **The 38 self-marked cards carry authored answers**, in `audit/selfmark-answers.json`.
  These are Hannetjie's own questions from quizzes Canvas marks yourself, so no marking
  schedule was ever published for them. They used to ship with the question and a
  paragraph explaining that fact and nothing else. Not having the schedule is a reason
  not to publish a schedule, not a reason to withhold the answer — so each now carries
  one, written for this pack against the slide-cited Module 1 hub, with a footer saying
  exactly whose answer it is. The key is `hash('flash|'+question)` and **not** the full
  `ckey`, because `ckey` folds in the answer text: an overlay may only key on fields it
  does not itself write.
- **The mock test is 29 auto + 6 written**, not 32 + 3, because our ordering and
  cloze items pay several marks each — 3 SAQs only came to 13% of marks, not the
  paper's stated 20%. The engine's mark projection derives the same split from
  `exam.mix` independently and lands on 19.5%.
- **`index.html` is ~1 MB**, almost all of it the eight ported raster figures.
  It loads once and is then offline.
- The tool bids into the hub's ⚡ study engine as `cram-hs2-test1`. It offers the
  same assessments as `hs2m1` (`hs2-t1`, `hs2-final`) — that is deliberate, since
  both are live tools for the same sitting, not a stale duplicate.
