# HS2 Test 1 Cram — Module 1

Cram tool for **Health Science 2 (722.541) Continuous Test 1** — Module 1:
Cardiovascular, Respiratory, Lymphatic. ProctorU, 65 min, 35 questions, 20% SAQ,
16.6% of the final grade.

**Live:** https://jeremyspm.github.io/hs2-test1/

## Why this exists in the shape it does

The course publishes a blueprint — `Science 2 Detailed Content.docx`, titled
*"Continuous Tests and Exam Focus Points"* — listing **36 numbered criteria** for
Module 1. Mapping both formative tests onto it:

| | Drilled | Partial | **Blind** |
|---|---|---|---|
| Cardiovascular (15) | 6 | 8 | 1 |
| Respiratory (17) | 5 | 6 | 5 |
| Lymphatic (4) | 1 | 2 | 1 |
| **36** | **12 (33%)** | 16 (44%) | **7 (19%)** |

**The formative tests directly drill only a third of the blueprint.** So the pack
is authored from the criteria, and the formatives are used only to calibrate how
each one gets asked. The eight `blind:true` criteria (the seven above plus the
Vaccination case study, which has zero immunology coverage anywhere in the course
material) carry a higher card floor and are oversampled by the exam sim.

Full gap analysis: [`../HS2-TEST1-CRAM-SPEC.md`](../HS2-TEST1-CRAM-SPEC.md).

## Contents

**382 cards** · 197 flash · 74 mcq · 27 match · 21 tfset · 17 order · 11 cloze ·
35 saq · 74 glossary terms · 15 figures.

Every card carries a `crit:` naming the blueprint criterion it covers, and the
build fails if any criterion drops below its floor (6 cards, or 10 plus an SAQ
for a blind spot).

## Build

The shipped `index.html` is a single self-contained offline file. It is generated,
because a 380-card pack is not editable inside one HTML file.

```bash
node build.mjs
```

Splices `pack.js` (+ the figures) into `../cram-engine/template.html` and reports
card counts and criterion coverage.

```bash
node port-figs.mjs           # re-extract figures from hs2-module1
node port-figs.mjs --check   # fail if they have drifted
```

Figures are copied **byte for byte** from `hs2-module1` — never re-drawn, never
re-described. `--check` is the enforcement. Run it before shipping.

## Editing content

Everything is in `pack.js`. Cards reference figures as `F('cvs3-ecg')` and
`FC('cvs3-ecg')`; `build.mjs` inlines them. To add a figure, add its id to
`WANTED` in `port-figs.mjs`, re-run it, then use it.

Card types beyond flash/mcq/saq — `order`, `cloze`, `tfset`, `match` — are
documented in [`../cram-engine/README.md`](../cram-engine/README.md). They exist
because the real Canvas paper uses them and they carry most of its marks: the
ECG cloze in the formative was worth 6 points and the acidosis cloze 10, against
1 for a typical MCQ.

## Where the content comes from — read this before trusting a number

Be clear about the split:

**Sourced from the Canvas export (verifiable):**
- The **scope** — all 36 criteria, from `Science 2 Detailed Content.docx`.
- The **test format** — 65 min, 35 questions, 20% SAQ, no rough paper, from the
  Assessment Overview page.
- **Which case studies are examinable** — blue = tests, yellow ★ = exam, stated
  outright in `Case Study Workbook 2026 S2.docx`.
- **46 of the 382 cards** carry a `src:` line naming the exact document and
  question. These render in-app as a 📄 Source line under the answer.
- Every marking schedule labelled "verbatim" was copied from the lecturer's own
  model answer in the Canvas formative.

**Not sourced from her material:** the remaining ~336 cards are standard textbook
anatomy and physiology written for this pack. They were then cross-checked
against `hs2-module1`, which *was* built from her lecture slides with per-answer
citations.

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
  excluded from the exam sim.
- **The exam sim is 30 auto + 5 written**, not 32 + 3, because our ordering and
  cloze items pay several marks each — 3 SAQs only came to 13% of marks, not the
  paper's stated 20%.
- **`index.html` is ~1 MB**, almost all of it the eight ported raster figures.
  It loads once and is then offline.
- The tool bids into the hub's ⚡ study engine as `cram-hs2-test1`. It offers the
  same assessments as `hs2m1` (`hs2-t1`, `hs2-final`) — that is deliberate, since
  both are live tools for the same sitting, not a stale duplicate.
