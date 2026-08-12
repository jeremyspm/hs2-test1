/* THE THREE QUESTIONS THE 50-MARK FORMATIVE HAD AND THE PACK DID NOT.

   MODULE 1: SAQ & MC: FORMATIVE CVS, LYMPHATIC & RESPIRATORY SYSTEMS *(50 marks) is the
   paper Hannetjie called the closest thing to the real test. The pack was built from a
   capture taken 5 Aug 2026 which held 11 of its questions. A fresh capture taken
   12 Aug 2026 holds SEVENTEEN, numbered differently, and three of them had no card
   anywhere in the pack:

     Q1   5    marks  asthma relievers/preventers on the conduction zone   (SAQ)
     Q14  4.5  marks  the asthmatic bronchiole — 9 dropdowns               (cloze)
     Q17  2.5  marks  three errors in the description of lymph flow        (SAQ)

   Twelve marks — a quarter of the paper she named — that guided mode could not deal
   because the cards did not exist. That is a bigger hole than any ordering bug, and it
   is why this file exists rather than a tie-break change.

   WHY A SEPARATE FILE, like coverage-fill.js. These are hand-assembled from a capture
   that is not in the corpus `harvest.mjs` reads, so they cannot come down the harvest
   path and they must not be laundered through pack.source.js — a source card with no
   entry in migration.json is tiered `textbook` with "no migration proposal was found",
   and `isManufactured` would then be entitled to cull it. That is the exact mechanism
   that deleted ten of her questions on 11 Aug. Cards that carry their own tier and their
   own evidence go in a file of their own, where it is obvious what they are.

   PROVENANCE. Every stem and every marking point below is hers, read out of the capture
   named in CAP. Q1 and Q17 print her model answer with her own mark splits — the quiz is
   student-marked and shows the schedule after submission. Q14's NINE CORRECT ANSWERS are
   hers, revealed by the capture; its DISTRACTORS are not — Canvas does not print the
   unchosen options of a dropdown, so the alternatives are written for this pack and the
   card says so. That is the same line case-studies.js draws: her question, her key, and
   anything authored labelled as authored.

   NOT DONE — Q16 (2 marks), "several errors were made when annotating this structure".
   Her answer names the corrections (label 3 is pseudostratified columnar epithelium, not
   cartilage; cartilage is 1; 6 is connective tissue) but the structure is an IMAGE the
   capture does not carry, so the question cannot be asked as she set it. Writing a
   trachea-histology card and calling it hers would be inventing a stem. It stays open. */

const CAP = 'MODULE 1： SAQ & MC： FORMATIVE CVS, LYMPHATIC & RESPIRATORY SYSTEMS ＊(50 marks)： Health Science 2 (8_12_2026 1：13：07 PM).html';
const SHA = '05e2aefb6371743abc0c472beaa0df609e7daad963e1f07575732eeaf20892a1';
const QUIZ = 'MODULE 1: SAQ & MC: FORMATIVE CVS, LYMPHATIC & RESPIRATORY SYSTEMS *(50 marks)';
const EV = (n) => ({ quiz: QUIZ, capture: CAP, captureSha: SHA, n });

/* The sentence every card here ends on. The reader is entitled to know that the options
   in front of them are not the options she wrote. */
const AUTHORED_OPTIONS =
  '<div class="srcline"><b>Hannetjie’s question, Hannetjie’s answers.</b> The nine correct ' +
  'answers above came straight from the formative. Canvas does not publish the alternatives in a ' +
  'dropdown, so the wrong options were written for this pack — do not read anything into their ' +
  'wording.</div>';

export const FORMATIVE_50 = [
  /* ═══ Q1 — 5 marks ════════════════════════════════════════════════════════
     Primary on resp-17 rather than resp-3: three of the five marks are the mechanism of
     a RELIEVER and a PREVENTER, and "Asthma", "Chronic Bronchitis" and "Bronchodilator"
     are named terms of criterion 17. The conduction-zone definition is the other two
     marks and rides along as alsoCrit. It also happens to fix the weakest lead in the
     pack — resp-17 was led by a one-part MCQ on pneumothorax, a term criterion 17 does
     not even list. */
  {
    type: 'saq', topic: 'resp-anat', crit: 'resp-17',
    alsoCrit: ['resp-2', 'resp-3', 'resp-7'],
    tier: 'verbatim', marks: 5, ev: EV('Question 1'),
    q: 'Asthma medications used as relievers and preventers have different effects on the ' +
       'respiratory system conduction zone structures.<br><br>' +
       '<b>1.</b> Define the term "conduction zone" and give examples of the structures found in it. <b>(2)</b><br>' +
       '<b>2.</b> Demonstrate your understanding of how reliever and preventer medication respectively ' +
       'help to treat asthma by describing their effects on the tissues found in the conduction zone. <b>(3)</b>',
    pointsTier: 'taught',
    points: [
      '<b>Conduction zone (1)</b> — all the structures involved in bringing air TO the respiratory zone: the nose, pharynx, trachea, bronchi and bronchioles, as far as the terminal bronchiole',
      '<b>Respiratory zone (1)</b> — by contrast, where gaseous exchange actually takes place: the respiratory bronchioles and the alveoli',
      '<b>Reliever (1.5)</b> — acts as a BRONCHODILATOR, relaxing the smooth muscle layer in the wall of the trachea, bronchi and bronchioles, increasing their diameter and so improving airflow',
      '<b>Preventer (1.5)</b> — a CORTICOSTEROID, acting as an anti-inflammatory by suppressing the overactive immune response (the asthma trigger is mast cells secreting histamine, which makes capillaries leaky and causes inflammation); it reduces the swelling of the epithelium, again widening the airway and improving airflow',
    ],
    model: 'This is Hannetjie’s own marking schedule, reproduced with those mark splits — the reliever and ' +
           'the preventer are worth 1.5 each and both marks are earned by naming the TISSUE the drug ' +
           'acts on (smooth muscle for the reliever, inflamed epithelium for the preventer) and ' +
           'finishing on the same end point: a wider airway and better airflow. Naming the drug class ' +
           'without the tissue is half an answer.',
  },

  /* ═══ Q14 — 4.5 marks ═════════════════════════════════════════════════════
     Nine dropdowns at half a mark each. Primary on resp-7: four of the nine blanks (2 of
     the 4.5 marks) are airway resistance and the accessory muscles, which is criterion 7
     word for word. The rest reaches resp-5, resp-9, resp-11 and resp-12 as alsoCrit —
     and those last two matter, because until this card the whole gas-transport half of
     the respiratory system had no card from her closest-to-the-test paper at all. */
  {
    type: 'cloze', topic: 'resp-mech', crit: 'resp-7',
    alsoCrit: ['resp-5', 'resp-9', 'resp-11', 'resp-12'],
    tier: 'verbatim', ev: EV('Question 14'),
    q: 'A bronchiole of a normal and of an asthmatic person. Work through what asthma does to ' +
       'ventilation, then the alveolus and how the blood carries the gases.',
    text: 'Pulmonary ventilation of an asthmatic person is affected by mucus clogging [[1]] and ' +
          'constriction of the [[2]] . This makes the inhalation [[3]] and [[4]] . ' +
          'The alveolus is the site of gas exchange. The [[5]] helps facilitate external respiration ' +
          'by providing a thin diffusion membrane. The cell type that produce surfactant is [[6]] . ' +
          'About 70% of CO₂ is transported as [[7]] and 98% of oxygen is transported as [[8]] . ' +
          'The conditions that favour the offloading of the oxygen molecules in the tissues include [[9]] .',
    blanks: [
      { options: ['the bronchi and bronchioli', 'the alveoli and alveolar ducts', 'the pleural cavity', 'the trachea only'], correct: 0 },
      { options: ['elastic fibres in the alveolar wall', 'smooth muscles in the bronchi and bronchioli', 'skeletal muscle of the diaphragm', 'the cartilage rings of the trachea'], correct: 1 },
      { options: ['laborious and necessitates the use of accessory muscles like the scalenes', 'easier because the airway recoils faster', 'unchanged, since inhalation is passive', 'silent, because no air moves at all'], correct: 0 },
      { options: ['brings more air to the alveoli', 'brings less air to the alveoli', 'has no effect on alveolar ventilation', 'increases the residual volume'], correct: 1 },
      { options: ['Cuboidal epithelium, alveolar cell type 2', 'Ciliated columnar epithelium', 'Squamous epithelium, alveolar cell type 1', 'The alveolar macrophage'], correct: 2 },
      { options: ['Squamous epithelium, alveolar cell type 1', 'Cuboidal epithelium, alveolar cell type 2', 'The alveolar macrophage', 'Goblet cells of the bronchiole'], correct: 1 },
      { options: ['carbaminohaemoglobin', 'dissolved CO₂ in the plasma', 'bicarbonate ions', 'carbonic anhydrase'], correct: 2 },
      { options: ['dissolved oxygen in the plasma', 'oxyhemoglobin', 'carbaminohaemoglobin', 'bicarbonate ions'], correct: 1 },
      { options: ['alkaline cold conditions', 'acidic warm conditions', 'low CO₂ and low temperature', 'high pH and high oxygen'], correct: 1 },
    ],
    why: 'Two halves, and the second is the one the pack was thin on. ' +
         '<b>Asthma</b> narrows the CONDUCTING airways — mucus in the lumen and smooth-muscle ' +
         'constriction in the wall — so resistance rises, inhalation needs the accessory muscles ' +
         '(the scalenes), and less air reaches the alveoli. ' +
         '<b>The alveolus:</b> type 1 cells are the thin squamous sheet gas actually crosses; ' +
         'type 2 cells are cuboidal and make surfactant. Do not swap them. ' +
         '<b>Transport:</b> CO₂ mostly travels as <b>bicarbonate</b> (~70%), oxygen almost entirely ' +
         'as <b>oxyhaemoglobin</b> (~98%). Oxygen is released where tissue is <b>acidic and warm</b> — ' +
         'the Bohr effect: exactly the conditions a working tissue creates for itself.' +
         AUTHORED_OPTIONS,
  },

  /* ═══ Q17 — 2.5 marks ═════════════════════════════════════════════════════
     Pure text, no figure, so it reproduces exactly as she set it. Two of its three errors
     were already reachable elsewhere in the pack; the one-way minivalve was not reachable
     at all. lymph-3 holds four cards against a floor of six, so this is load-bearing
     rather than another card on a crowded point. */
  {
    type: 'saq', topic: 'lymph', crit: 'lymph-3',
    alsoCrit: ['lymph-2'],
    tier: 'verbatim', marks: 2.5, ev: EV('Question 17'),
    q: 'THREE serious errors were made in this description of the factors that make lymph flow. ' +
       'Find the errors and correct them.<br><br>' +
       '<i>Formation of interstitial fluid pressure: excess fluid filtered from blood capillaries enters ' +
       'lymphatic capillaries through <b>two-way minivalves</b>, creating a continuous flow of lymph toward ' +
       'larger lymphatic vessels.<br>' +
       'Intrinsic contraction of lymphatic vessels: smooth muscle in the walls of larger lymphatic vessels ' +
       'contracts rhythmically, helping to pump lymph centrally.<br>' +
       'Skeletal muscle pump: contraction of surrounding skeletal muscles compresses lymphatic vessels, ' +
       'pushing lymph forward.<br>' +
       'Respiratory pump: during <b>expiration</b>, pressure in the thorax decreases while abdominal pressure ' +
       'increases, drawing lymph toward the thoracic cavity and the major lymphatic ducts.<br>' +
       'One-way valves: numerous valves within lymphatic vessels prevent backflow and ensure movement toward ' +
       'the venous circulation, connecting the lymphatic system at the <b>iliac veins</b>.<br>' +
       'Arterial pulsations and body movements: pulsations of nearby arteries and general body movements ' +
       'intermittently compress lymphatic vessels, assisting lymph propulsion.</i> (2.5 marks)',
    pointsTier: 'taught',
    points: [
      '<b>"through two-way minivalves"</b> → they are <b>ONE-WAY</b> minivalves. The overlapping endothelial flaps open inwards under interstitial pressure and are pushed shut from inside, which is the whole reason fluid can enter a lymphatic capillary and not leak back out',
      '<b>"during expiration, pressure in the thorax decreases"</b> → that happens during <b>INSPIRATION</b>. Thoracic pressure falls and abdominal pressure rises as the diaphragm descends, and that pressure difference draws lymph upward',
      '<b>"connecting the lymphatic system at the iliac veins"</b> → lymph rejoins the blood at the <b>SUBCLAVIAN VEINS</b> — the thoracic duct on the left, the right lymphatic duct on the right',
    ],
    model: 'Hannetjie’s own corrections, in the order they were published. The three planted errors are each a direction-of-flow ' +
           'error: which way the minivalve opens, which breath lowers thoracic pressure, and where ' +
           'lymph finally rejoins the blood. Everything else in the passage is correct and is worth ' +
           'reading as a checklist of the six factors that actually move lymph.',
  },
];
