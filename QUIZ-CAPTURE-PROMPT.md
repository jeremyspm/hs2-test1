# Prompt for Claude in Chrome — capture the HS2 quizzes

Canvas will not export quizzes, so these ~13 exist only as links. The two
formative tests in the archive were captured by **submitting an attempt**, which
reveals the questions and model answers. That's the whole trick.

Open Chrome, log in to Canvas, open the Claude side panel, and paste the prompt
below.

---

## The prompt

> I'm on Canvas at Manukau Institute of Technology, logged in as a student in
> **Health Science 2 (722.541), course 61986**. I have a ProctorU test on 23
> August covering Module 1 and I'm building a revision deck from the course's own
> questions.
>
> I want you to work through the quizzes in this course and capture each one as
> plain text I can save. Work through them **one at a time** and show me each
> result before moving on.
>
> **For each quiz, in this order:**
>
> 1. Open the quiz page and, before doing anything else, tell me: its **name**,
>    the **points available**, the **time limit**, the **number of allowed
>    attempts**, and whether it is **graded or ungraded/practice**.
> 2. **Stop and ask me before you start, submit, or interact with any attempt.**
>    I will tell you whether to proceed. Do not assume — some of these carry
>    marks and I don't want an attempt burned or a zero recorded.
> 3. Once I say go, open the attempt, and for **every question** capture:
>    the full question text, every answer option, which option is marked correct,
>    the model answer or marking schedule if one is shown, and any feedback or
>    explanation text.
> 4. Give it to me as **plain text or markdown**, question by question, in the
>    order they appear. Don't summarise, don't paraphrase, don't shorten — I need
>    her exact wording, because the real test reuses it.
> 5. If a question has an image, describe what it shows and what is labelled,
>    since I can't copy the image itself.
>
> **The quizzes I want, in priority order:**
>
> 1. `MODULE 1: SAQ & MC: FORMATIVE CVS, LYMPHATIC & RESPIRATORY SYSTEMS` (50 marks)
> 2. `722.541 2026 PROCTORU TRIAL TEST`
> 3. `MODULE 1.1: SAQ & MC: CVS REVIEW` (35 marks)
> 4. `MODULE 1.1: QUIZ: CVS2 THE HEART` (25 marks)
> 5. `MODULE 1.2: SAQ RESPIRATORY SYSTEM` (20 marks)
> 6. `MODULE 1.1: SAQ STUDENT MARKED CVS LAB REVIEW` (15 marks)
> 7. `MODULE 1.3: SAQ & MC: FLUID, ELECTROLYTE & FLUID BALANCE` (10 marks)
> 8. `MODULE 1.3: QUIZ: DISEASES / TERMINOLOGY RELATED TO THE LYMPHATIC SYSTEM`
> 9. `MODULE 1.1 SHOCK QUIZ` (5 marks)
> 10. `Practice Lab 1: SAQ & MC Quiz` (10 marks)
> 11. `Practice Lab 2: SAQ & MC Quiz` (10 marks)
> 12. `Respiratory Pre-Lab Quiz`
> 13. `Knowledge Check Quiz`
>
> Most of these live under the module section **"16 SAQ QUIZZES (STUDENT MARKED)
> (-ESSENTIAL)"**. Start by listing every quiz you can find in the course and
> which section it's in, so we can check nothing is missed, then begin with
> number 1.
>
> Two things to keep in mind throughout:
> - **Never submit an attempt without asking me first.**
> - If a quiz shows a previous attempt of mine, capture that results page rather
>   than starting a new attempt.

---

## After you have the text

Save each quiz as its own `.md` or `.txt` file into `github/_inbox/HEALTH SCIENCE 2/`
and tell me — I'll fold them into the pack, replacing my textbook-written cards
with her actual wording wherever they overlap, and I'll re-check the eight
"blind" criteria against what the quizzes actually cover.

## Why the priority order

1 and 2 are worth more than the rest combined. **#1** is a 50-mark paper across
all three Module 1 systems — the closest thing to a full mock. **#2** is a
rehearsal of the actual ProctorU setup, so it's worth doing properly once even if
the questions turn out to be trivial: you find out whether your camera, ID check
and room scan work *before* the day.

**#4, #5, #8 and #9 matter disproportionately** because they hit criteria this
pack currently flags as blind — heart sounds, respiratory anatomy, lymphatic
terminology, and shock. If those quizzes cover them, the blind list shrinks and
the priority queue should be rebalanced.
