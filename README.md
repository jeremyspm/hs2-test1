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
for a never-practised one). That gate is what lets the page stop warning the reader:
validation output goes to the console and the **Sources** tab, `?dev=1` brings the
banner back for authoring, and a failing pack simply does not build.

## Start in the Brief

The **Brief** tab is the study guide: one section per focus point, in the order the
course publishes them, written out as prose. It is generated from the pack's flash
answers — the same content the flip cards use, read as a page instead of as
questions. Each section ends with **▸ Drill this**, which points Learn and Drill at
that focus point alone; get a drill question wrong and **→ Read the full explanation**
brings you straight back to its section.

Open the tool with no saved progress and it **lands there**, deliberately. Learn
opens by asking you to recall something; on a topic you only half-absorbed in the
lecture, that is the slowest and most discouraging way in. Read the section, mark
it read, then drill it.

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

## Build

The shipped `index.html` is a single self-contained offline file. It is generated,
because a 380-card pack is not editable inside one HTML file.

```bash
node audit/apply-migration.mjs --write   # regenerate pack.js from the evidence base
node audit/validate.mjs                  # 11 gates over the evidence
node build.mjs                           # splice into the engine → index.html
```

`pack.js` is **generated** — `audit/apply-migration.mjs` assembles it from
`pack.source.js`, `migration.json`, the harvest, the case studies and
`coverage-fill.js`, then runs the voice pass. Do not hand-edit it. `build.mjs`
splices it (plus the figures) into `../cram-engine/template.html`, reports card
counts, and **exits non-zero if any focus point is under its card floor**.

```bash
node port-figs.mjs           # re-extract figures from hs2-module1
node port-figs.mjs --check   # fail if they have drifted
```

Figures are copied **byte for byte** from `hs2-module1` — never re-drawn, never
re-described. `--check` is the enforcement. Run it before shipping.

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

The other 172 land on a synthesised line (the correct option, the pairs or blanks
missed) plus a link into the Brief. That is the engine's floor, not a substitute:
**authoring `why:` for those 172 is the highest-value writing left in this pack.**

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

## Notes

- **`lean:'exam'`** marks content the lecturer flagged as final-exam-only (the
  acidosis→chemoreceptor→phrenic cascade). It stays in Learn and Drill and is
  excluded from the mock test.
- **The mock test is 29 auto + 6 written**, not 32 + 3, because our ordering and
  cloze items pay several marks each — 3 SAQs only came to 13% of marks, not the
  paper's stated 20%. The engine's mark projection derives the same split from
  `exam.mix` independently and lands on 19.5%.
- **`index.html` is ~1 MB**, almost all of it the eight ported raster figures.
  It loads once and is then offline.
- The tool bids into the hub's ⚡ study engine as `cram-hs2-test1`. It offers the
  same assessments as `hs2m1` (`hs2-t1`, `hs2-final`) — that is deliberate, since
  both are live tools for the same sitting, not a stale duplicate.
