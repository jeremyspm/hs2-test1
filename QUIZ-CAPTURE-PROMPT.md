# Capture the two remaining HS2 quizzes

**Updated 5 Aug 2026** after the provenance audit. 18 of the 20 quizzes on the original
list are already captured, parsed, and in `audit/questions.json` — 236 questions, 180
with machine-extracted answer keys. **Two are still missing, and one capture needs
redoing.** That is all this document is now for.

Everything here needs you, in Chrome, logged into Canvas. It is the only part of the
rebuild that cannot be done from the repo.

---

## Why these three, and nothing else

### 1. `722.541 2026 PROCTORU TRIAL TEST` — do this first, regardless of its questions

This is the only rehearsal of the real exam setup: camera, photo ID, room scan, the
lock-down flow. **Finding out on 23 August that your webcam or ID check fails is a loss
no revision card can offset.** Its questions are a bonus; the dry run is the point.

### 2. `Practice Lab 2: SAQ & MC Quiz (10 marks)` — RE-CAPTURE, submitted

We already have a capture of this one. It is unusable, and the audit worked out why.

| | Practice Lab 1 | Practice Lab 2 |
|---|---|---|
| Captured from | a **submitted** attempt | an **unsubmitted** attempt |
| Auto-marked questions | 10 | 10 |
| …with a recovered key | **10 / 10** | **0 / 10** |

Same quiz family, same parser, same selectors, opposite outcome. **Canvas only reveals
the answer key once an attempt is submitted.** Practice Lab 2's 8 multiple-choice, 1
matching and 1 multiple-dropdown question all have keys sitting behind that submission.

It is also the most valuable one to recover: **all 11 of its questions carry images**
(`trachea cross section`, `bell jar numbered`, `resp system numbered`) — the
label-the-diagram format. The current 392-card pack drills that format **zero** times,
and answers to image questions cannot be authored blind. Recovering hers is the only
route.

### 3. `Knowledge Check Quiz` — only if it is free

Low value. Skip it if anything above is at risk.

---

## Before you start

**Check whether an attempt costs you anything.** Practice Lab 2 is a practice quiz, but
open it and read the header first: points, time limit, attempts allowed, graded vs
practice. If it says **unlimited attempts** and is ungraded, submitting is free and you
should submit. If attempts are limited or it is graded, stop and tell me — a recovered
answer key is not worth a recorded mark.

The Trial Test is a rehearsal by design; submitting it is the intended use.

---

## The prompt for Claude in Chrome

Open Chrome, log into Canvas, open the Claude side panel, and paste this:

> I'm on Canvas at Manukau Institute of Technology, logged in as a student in
> **Health Science 2 (722.541), course 61986**. I have a ProctorU test on 23 August and
> I'm recovering two quizzes for a revision tool.
>
> **Quiz A — `722.541 2026 PROCTORU TRIAL TEST`**
> **Quiz B — `Practice Lab 2: SAQ & MC Quiz (10 marks)`**
>
> For each one, in this order:
>
> 1. Open the quiz page. Before doing anything else, tell me its **name**, **points
>    available**, **time limit**, **number of attempts allowed**, and whether it is
>    **graded or ungraded/practice**. Then stop.
> 2. **Wait for me to say go before starting or submitting any attempt.** Do not assume.
> 3. Once I say go: complete the attempt (answers can be wrong — I only need the results
>    page) and **submit it**, because Canvas does not reveal the answer key until an
>    attempt is submitted.
> 4. On the results page, save the **whole page** — File → Save Page As → *Webpage,
>    Complete*. Do not copy the text out; the answer key lives in the page's HTML
>    attributes and is lost if you paste it as plain text.
> 5. For every question, also tell me in the chat: the full question text, every option,
>    which option is marked correct, and any model answer or feedback shown.
> 6. If a question shows an image, describe what it shows and what is labelled.
>
> Two standing rules: **never submit an attempt without asking me first**, and if a quiz
> shows a previous attempt of mine, capture that results page rather than starting a new
> one.

---

## Where to put the files

Save both `.html` files into:

```
github/_inbox/Health Science 2 Export Module 1/
```

Folder does not matter — the parser walks the whole tree. Keep Chrome's default filename.

Then tell me, and I run:

```bash
node audit/run-all.mjs
```

**What proves it worked:** `parse-quizzes.mjs` picks both up, and Practice Lab 2 reports
**≥10 keyed** instead of 0. If it still says 0, the attempt did not submit and the page
was saved from the pre-submission view.

---

## Everything else on the old list is done

The original 13-quiz priority list is captured, sha256-pinned in `audit/registry.json`,
and harvested into `audit/harvested.js`. Do not re-capture any of them — including the
50-mark Module 1 formative, CVS REVIEW, CVS2 THE HEART, the lymphatic terminology quiz,
the shock quiz and Practice Lab 1. They are all in, with their keys.
