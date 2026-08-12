/* CARDS FOR THE THINGS THE PUBLISHED CHECKLIST NAMES AND THE PACK NEVER ASKED.

   An audit on 12 Aug 2026 mapped `ASSESSMENT CRITERIA.docx` — all 36 criteria, phrase by
   phrase — against every card in the pack. Coverage was good at criterion level and had
   holes INSIDE criteria, which no per-criterion count can see:

     cvs-7   "and the best places where the sounds can be detected"
             → auscultation, intercostal spaces and the listening posts appeared in ZERO
               cards. The whole criterion had one card, about what causes a murmur.
     cvs-4   "and velocity of blood flow"
             → no card asked it, though she has a slide that poses the question outright.
     resp-8  "Explain the DIFFERENCE in the composition of atmospheric air and alveolar air"
             → six cards on atmospheric air, none on alveolar, so the difference — which is
               the whole criterion — was never asked.
     resp-16 "exercise, body temperature, PAIN, and irritation to air passageways"
             → "pain" appeared in no card at all, and this is a declared BLIND point whose
               lead card was about high altitude, which is not one of the four.
     cvs-15  33 named terms → 8 existed only in the glossary, which the queue never deals:
               pressure points · coronary circulation · atrial diastole · pericarditis ·
               myocarditis · endocarditis · asystole · ventricular fibrillation
     resp-17 22 named terms → 4 glossary-only: hypocapnia · apnoea · tuberculosis · tachypnoea

   `lymph-4` is the model every terminology card here copies: ONE match card carrying seven
   of its nine named terms, dealt in Round 1. A term in the glossary is a term the reader
   must go looking for; a term in a match card is one they get asked.

   TIERS ARE NOT UNIFORM HERE, on purpose. Four of these are `taught` — her own slides
   cover them and the build re-greps the quote out of corpus.json every run. Three are
   `textbook`, because the concept genuinely is not in her material at any location, and
   the card says so rather than implying a slide behind it.

   ── WHY `gapFill` EXISTS ──────────────────────────────────────────────────────
   `cullBackground` drops any `textbook` card whose focus points ALL already carry a
   sourced card, on the reasoning that it is padding on ground her real questions hold.
   That reasoning is right at criterion level and blind below it: `cvs-15` holds 47 of her
   questions and still never once asked what pericarditis is. So a card here may set
   `gapFill: true` to be exempt — and because an exemption with no gate is just a way to
   smuggle padding back in, `gapFill` REQUIRES `gapTerms`, and build.mjs G30 fails if any
   declared term is already tested by another card in the pack. The exemption can only
   ever be spent on something genuinely absent. */

const CV23 = 'SRC-2026-CARDIOVASCULAR-SYSTEM-2-3';
const CAPF = 'SRC-CAPILLARIES-FLUID-AND-FLOW';
const RESP2 = 'SRC-2026-RESP2';
const RESP3 = 'SRC-2026-RESP-3';

export const GAP_FILL = [
  /* ═══ cvs-7 — WHERE the sounds are heard ══════════════════════════════════
     The criterion has two halves and the pack only ever had the first. Her slide 32 is
     the Patton figure showing the valves projected onto the chest wall with a stethoscope
     inset, so the CONCEPT is hers and quotable; the individual intercostal positions are
     read off that figure and are standard, which the answer states. */
  {
    type: 'match', topic: 'cvs-ecg', crit: 'cvs-7', tier: 'taught',
    ev: { src: CV23, loc: 'slide 32', quote: 'Valves of heart are projected on anterior thoracic wall' },
    q: 'Match each valve to the place on the chest wall where its sound is best heard.',
    pairs: [
      ['Aortic valve', '2nd intercostal space, RIGHT sternal edge'],
      ['Pulmonary valve', '2nd intercostal space, LEFT sternal edge'],
      ['Tricuspid valve', '4th–5th intercostal space, LEFT sternal edge'],
      ['Mitral valve', '5th intercostal space, left midclavicular line — the apex'],
    ],
    why: 'The trap is assuming you listen directly <i>over</i> the valve. You do not. Sound ' +
      'travels <b>downstream, in the direction the blood is moving</b>, so each valve is heard ' +
      'out along the vessel or chamber it empties into — which is why the aortic and pulmonary ' +
      'posts are up at the 2nd space while the valves themselves sit close together behind the ' +
      'sternum. Working down the chest the order is <b>A · P · T · M</b> — Aortic, Pulmonary, ' +
      'Tricuspid, Mitral. The mitral post is the <b>apex beat</b>, 5th space in the midclavicular ' +
      'line, which is also where you feel the heart hit the chest wall.' +
      '<div class="srcline">The lecture projects Patton’s figure of the valves on the anterior ' +
      'thoracic wall and names auscultation. The individual intercostal positions are read off ' +
      'that figure and are the standard clinical posts — they are not written out in the slide text.</div>',
  },

  /* ═══ cvs-4 — velocity of blood flow ══════════════════════════════════════
     Her own slide asks this as a question and answers it in one line. It had no card. */
  {
    type: 'mcq', topic: 'cvs-vessels', crit: 'cvs-4', alsoCrit: ['cvs-3'], tier: 'taught',
    ev: { src: CAPF, loc: 'slide 31', quote: 'Slow capillary flow allows adequate time for exchange between blood and tissues' },
    q: 'Blood moves more slowly through the capillaries than anywhere else in the circulation. Why does that matter?',
    options: [
      'It gives enough time for exchange between the blood and the tissues',
      'It lowers the blood pressure enough to stop the capillaries bursting',
      'It allows red cells to line up single file and pick up more oxygen',
      'It prevents clotting in the smallest vessels',
    ],
    correct: 0,
    why: 'This is the point of the whole capillary bed, and it follows from a rule worth knowing: ' +
      '<b>velocity is inversely proportional to the total cross-sectional area</b> of the vessels ' +
      'the blood is passing through. Each capillary is tiny, but there are billions of them, so ' +
      'their <i>combined</i> cross-section is enormous — and the flow slows to a crawl. ' +
      '<b>Slow flow means time</b>, and time is what diffusion needs. ' +
      'Do not confuse this with pressure: velocity (how fast) and pressure (how hard) fall along ' +
      'the circuit for different reasons, and the criterion asks you to relate blood pressure, ' +
      'blood flow, peripheral resistance <i>and</i> velocity — four things, not three.',
  },

  /* ═══ resp-8 — the DIFFERENCE, which is the actual criterion ══════════════
     Every figure below is hers and declared in audit/quantities.json, so
     check-quantities.mjs verifies them against her slides on every run. */
  {
    type: 'cloze', topic: 'resp-gas', crit: 'resp-8', alsoCrit: ['resp-5', 'resp-9'], tier: 'taught',
    ev: { src: RESP2, loc: 'slide 27', quote: 'P | O2 | 104 mmHg' },
    q: 'Air in the alveoli is not the air you breathed in. Work through what is different and why.',
    text: 'In atmospheric air at sea level the partial pressure of oxygen is [[1]] , and the partial ' +
      'pressure of carbon dioxide is only [[2]] . By the time that air reaches the alveoli, the ' +
      'PO₂ has fallen to [[3]] and the PCO₂ has risen to [[4]] . Three things account for the ' +
      'change. The air is [[5]] as it passes through the conducting zone, and the water vapour ' +
      'added ([[6]] ) takes up part of the total pressure. Oxygen is continuously [[7]] , while ' +
      'carbon dioxide moves the other way. And the fresh air that arrives is [[8]] .',
    blanks: [
      { options: ['159.6 mmHg', '104 mmHg', '760 mmHg', '40 mmHg'], correct: 0 },
      { options: ['40 mmHg', '0.2 mmHg', '47 mmHg', '7.4 mmHg'], correct: 1 },
      { options: ['159.6 mmHg', '40 mmHg', '104 mmHg', '592.8 mmHg'], correct: 2 },
      { options: ['0.2 mmHg', '104 mmHg', '47 mmHg', '40 mmHg'], correct: 3 },
      { options: ['cooled and dried', 'warmed and humidified', 'compressed', 'filtered of all water'], correct: 1 },
      { options: ['47 mmHg of water vapour', '0.2 mmHg of water vapour', '592.8 mmHg of water vapour', 'no measurable water vapour'], correct: 0 },
      { options: ['added to the alveolar air from the blood', 'removed from the alveolar air into the blood', 'unchanged in the alveolar air', 'converted to carbon dioxide in the alveolus'], correct: 1 },
      { options: ['pure, replacing all the gas in the lung with each breath', 'mixed with the air already in the lungs, which is never fully emptied', 'held in the trachea until the next breath', 'diverted past the alveoli entirely'], correct: 1 },
    ],
    why: 'The criterion asks for the <b>difference</b>, so an answer that only recites the ' +
      'atmospheric figures earns nothing. Three mechanisms, and they are the marks: ' +
      '<b>humidification</b> (water vapour at 47 mmHg is now part of the total, so every other ' +
      'gas gets a smaller share of the same 760), <b>gas exchange</b> (O₂ leaving into the blood, ' +
      'CO₂ arriving from it — this is the big one, and it is why alveolar PCO₂ is 200× the ' +
      'atmospheric figure), and <b>mixing</b> (a breath of fresh air joins the residual volume ' +
      'that never leaves, so it is diluted before it ever reaches the membrane). ' +
      'The numbers are the lecture’s own, not a textbook’s.',
  },

  /* ═══ resp-16 — pain, using her own post-op case ═════════════════════════ */
  {
    type: 'mcq', topic: 'resp-control', crit: 'resp-16', alsoCrit: ['resp-7', 'resp-14'], tier: 'taught',
    ev: { src: RESP3, loc: 'slide 36', quote: 'it hurt to move, blink, or take even a little breath' },
    q: 'Robert wakes from abdominal surgery in severe pain — it hurts to take even a small breath. What happens to his ventilation, and what does it cost him?',
    options: [
      'Breathing becomes rapid and deep, blowing off too much CO₂ and making his blood alkaline',
      'Breathing becomes shallow, so less CO₂ is cleared and his blood turns more acidic',
      'Pain has no effect on ventilation, which is controlled only by chemoreceptors',
      'Breathing stops altogether until the pain is treated',
    ],
    correct: 1,
    why: 'Pain does two opposite things and the criterion wants both. A <b>sudden, sharp</b> pain ' +
      'triggers a reflex gasp and then faster breathing. But <b>pain that hurts to breathe through</b> ' +
      '— an abdominal or chest wound, broken ribs — makes breathing <b>shallow and guarded</b>, ' +
      'because the patient is splinting the injury. ' +
      'Shallow breaths move less air past the dead space, so <b>alveolar ventilation falls</b>: CO₂ is ' +
      'retained, carbonic acid builds, and the blood becomes more <b>acidic</b> (respiratory acidosis). ' +
      'It also leaves the bases of the lungs poorly inflated, which is why the nurse in the lecture’s ' +
      'own case study makes Robert take a deep breath and cough despite the pain — the alternative is ' +
      'atelectasis and a chest infection.',
  },

  /* ═══ resp-16 — body temperature. NOT in her material anywhere. ══════════ */
  {
    type: 'mcq', topic: 'resp-control', crit: 'resp-16', tier: 'textbook',
    gapFill: true, gapTerms: ['body temperature'],
    srcNote: 'The criterion names body temperature, but no slide or quiz in the captured course ' +
      'material states its effect on ventilation. This is standard physiology written for this pack.',
    q: 'A patient spikes a fever of 39.5 °C. What happens to their rate and depth of breathing?',
    options: [
      'Ventilation increases — a rise in body temperature raises the metabolic rate',
      'Ventilation decreases, to conserve heat',
      'Ventilation is unchanged; temperature acts only on the heart',
      'Ventilation becomes irregular but the total volume is unchanged',
    ],
    correct: 0,
    why: 'Follow the metabolism. A <b>rise</b> in body temperature speeds every chemical reaction in ' +
      'the body, so the tissues consume more O₂ and produce more CO₂ — and ventilation rises to match. ' +
      'Raised temperature also acts <b>directly</b> on the respiratory centres in the brainstem. ' +
      'That is why a feverish patient is visibly breathing faster before anything is wrong with their ' +
      'lungs. The reverse holds too: <b>hypothermia depresses ventilation</b>, which is part of why a ' +
      'severely cold patient breathes slowly and shallowly.',
  },

  /* ═══ cvs-15 — the eight terms that lived only in the glossary ═══════════
     Criterion 15 is an explicit "explain the following terms" list of 33. Eight of them
     were reachable only by opening the glossary and looking them up. Built as one match
     card on the lymph-4 pattern so the whole set is dealt at once. */
  {
    type: 'match', topic: 'cvs-anat', crit: 'cvs-15', alsoCrit: ['cvs-5', 'cvs-8'], tier: 'textbook',
    gapFill: true,
    gapTerms: ['pericarditis', 'myocarditis', 'endocarditis', 'asystole', 'ventricular fibrillation', 'pressure point', 'coronary circulation', 'atrial diastole'],
    srcNote: 'Criterion 15 lists these by name. They are standard definitions written for this ' +
      'pack — the course names the terms but publishes no definitions for them.',
    q: 'Criterion 15 asks you to explain a list of terms. Match each of these to what it means.',
    pairs: [
      ['Pericarditis', 'Inflammation of the sac around the heart — sharp chest pain, worse lying flat, eased by sitting forward'],
      ['Myocarditis', 'Inflammation of the heart MUSCLE itself, which weakens the pump'],
      ['Endocarditis', 'Inflammation of the heart’s inner lining and its valves, usually from infection'],
      ['Asystole', 'No electrical activity and no contraction at all — a flat line, not a shockable rhythm'],
      ['Ventricular fibrillation', 'Ventricles quiver chaotically instead of contracting, so no blood is pumped — shockable'],
      ['Pressure point', 'A place where an artery runs over a bone, so pressing there slows bleeding downstream'],
      ['Coronary circulation', 'The heart’s own blood supply — arteries off the aortic root, draining via the coronary sinus'],
      ['Atrial diastole', 'The phase in which the atria are relaxed and filling with returning blood'],
    ],
    why: 'Two pairs are worth separating deliberately. ' +
      '<b>The three -itis terms are told apart by the LAYER</b>, working inwards: peri- the sac, ' +
      'myo- the muscle, endo- the lining and valves. ' +
      '<b>Asystole and ventricular fibrillation are both cardiac arrest and are not the same thing</b> — ' +
      'VF is chaotic electrical activity with no useful output and is shockable; asystole is no ' +
      'electrical activity at all and defibrillating it achieves nothing. ' +
      'And note <b>atrial diastole is relaxation, not contraction</b> — systole is always the ' +
      'contracting phase, diastole always the relaxed one, whichever chamber is named.',
  },

  /* ═══ resp-17 — the four glossary-only respiratory terms ═════════════════ */
  {
    type: 'match', topic: 'resp-mech', crit: 'resp-17', alsoCrit: ['resp-14'], tier: 'textbook',
    gapFill: true,
    gapTerms: ['hypocapnia', 'apnoea', 'tuberculosis', 'tachypnoea'],
    srcNote: 'Criterion 17 lists these by name. Standard definitions written for this pack — the ' +
      'course names the terms but publishes no definitions for them.',
    q: 'Criterion 17 asks you to explain a list of terms. Match each of these to what it means.',
    pairs: [
      ['Hypocapnia', 'Too LITTLE carbon dioxide in the blood — what hyperventilating causes'],
      ['Apnoea', 'Breathing stops altogether, for a period'],
      ['Tachypnoea', 'Breathing that is abnormally FAST (the rate, not the effort)'],
      ['Tuberculosis', 'A bacterial lung infection that walls itself off in the tissue, causing a chronic cough'],
    ],
    why: 'Build these from the word parts and you never have to memorise them. ' +
      '<b>-capnia</b> is carbon dioxide, so <b>hypo</b>capnia is too little and <b>hyper</b>capnia too ' +
      'much — and hypocapnia is the <i>result</i> of hyperventilation, not another word for it. ' +
      '<b>-pnoea</b> is breathing: <b>a</b>pnoea none, <b>eu</b>pnoea normal, <b>tachy</b>pnoea fast, ' +
      '<b>dys</b>pnoea difficult. Keep <b>tachypnoea</b> (fast) apart from <b>dyspnoea</b> (laboured) — ' +
      'a patient can be one without the other, and the exam list contains both.',
  },
];
