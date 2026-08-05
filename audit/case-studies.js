/* Phase 4 item 6 — marking schedules for the two TEST case studies.
   Case Study 1 (Blood pressure) and Case Study 5 (Vaccination and immunisation) are the
   two unstarred case studies; the workbook states outright that unstarred ones sit in
   the tests and starred ones in the exam.

   PROVENANCE, per Decision 1 and spec §4.1:
   - The QUESTION on every card is hers, quoted from the Case Study Workbook.
   - Each MARKING POINT carries its own evidence. A point pinned to her material is
     `taught` and quotes it; a point that cannot be pinned is `textbook` and says so.
   - No authored point is ever presented as hers.

   `points` stays an array of strings because that is what the engine renders and counts
   for marks; `pointEv` is index-aligned evidence, checked by verify-case-studies.mjs. */

const WB = 'SRC-CASE-STUDY-WORKBOOK-2026-S2';
const MA = 'SRC-BN2-FORMATIVE-TEST-MODEL-ANSWERS-FOR-CANVAS';
const LY = 'SRC-2026-LYMPHATIC-SYSTEM';
const REV = 'SRC-2020A-REVISION-MOD-1-16-SLIDE-1';
const CSMA = 'SRC-CASE-STUDIES-2003-MODEL-ANSWERS';
const CAP = 'SRC-CAPILLARIES-FLUID-AND-FLOW';

const T = (src, loc, quote) => ({ tier: 'taught', src, loc, quote });
const B = (why) => ({ tier: 'textbook', why });

export const CASE_STUDIES = [
  /* ═══ CASE STUDY 1 — BLOOD PRESSURE ═══════════════════════════════════════ */
  {
    type: 'saq', topic: 'cvs-bp', crit: 'cs-bp', tier: 'verbatim', marks: 5,
    ev: { src: WB, loc: 'para 29', quote: 'How does the nervous system detect and return blood pressure to normal when it is lower than normal' },
    q: 'How does the nervous system detect and return blood pressure to normal when it is lower than normal? (5 marks)',
    pointsTier: 'taught',
    points: [
      'Blood pressure is sensed by BARORECEPTORS, which detect the stretch of the vessels — found in the aortic arch and the carotid sinus',
      'The baroreceptors signal to the CARDIAC CENTRE of the brain, which has three parts: the cardioacceleratory centre (speeds the heart), the cardioinhibitory centre (slows it) and the vasomotor centre (controls vessel diameter)',
      'The cardioacceleratory centre is stimulated and the cardioinhibitory centre inhibited, giving a faster heart rate and increased force of contraction, so CARDIAC OUTPUT rises',
      'The vasomotor centre signals the vessels to VASOCONSTRICT, so resistance inside them rises and peripheral resistance (PR / SVR) increases',
      'Both CO and PR determine blood pressure, so as they rise blood pressure returns to normal',
    ],
    pointEv: [
      T(MA, 'slide 37', 'Blood pressure is sensed by | barorepectors | , which detect the stretch of the vessels'),
      T(MA, 'slide 37', 'The baroreceptors signal to the cardiac | centre | of the brain'),
      T(MA, 'slide 37', 'is stimulated and the | cardioinhibitory | | centre | is inhibited'),
      T(MA, 'slide 37', 'The vasomotor | centre | sends signals to the blood vessels'),
      T(MA, 'slide 37', 'Both CO and PR determine blood pressur'),
    ],
    model: 'Her own model answer for this question is reproduced point for point — the wording above follows the marking schedule she published in the BN2 Formative Test model answers.',
  },
  {
    type: 'saq', topic: 'cvs-bp', crit: 'cs-bp', tier: 'verbatim', marks: 6,
    ev: { src: WB, loc: 'para 32', quote: 'The kidneys normally help to increase blood pressure if it is too low' },
    q: 'The kidneys normally help to increase blood pressure if it is too low — a slower process taking minutes to hours. Explain how this occurs. (6 marks)',
    pointsTier: 'taught',
    points: [
      'The kidney has its own baroreceptor, the JUXTAGLOMERULAR APPARATUS, which senses the change in blood pressure and initiates the response',
      'DIRECT mechanism: glomerular filtration rate (GFR) falls, so the kidney filters more slowly',
      'Urine production slows, so fluid is retained in the blood — blood volume rises, and higher volume stretches the vessels, raising blood pressure',
      'INDIRECT mechanism, at the same time: the kidney releases RENIN, an enzyme that converts angiotensinogen from the liver into angiotensin I',
      'Angiotensin I travels to the LUNGS where ACE converts it to ANGIOTENSIN II',
      'Angiotensin II raises blood pressure several ways — vasoconstriction (raising PR), and release of ADH (posterior pituitary, water reabsorption) and aldosterone (adrenal cortex, Na⁺ then water reabsorption), both raising blood volume',
    ],
    pointEv: [
      T(MA, 'slide 32', 'juxtaglomerular apparatus which are cells in the kidney'),
      T(MA, 'slide 32', 'reduction in the glomerular filtration rate (or GFR), so the kidney slows the ra'),
      T(MA, 'slide 32', 'urine production also slows down. This results in fluid being maintained in the blood'),
      T(MA, 'slide 32', 'releases Renin. Renin is an enzyme and converts Angiotensinogen from the liver to Angiotensin I'),
      T(MA, 'slide 32', 'Angiotensin I travels to the lungs where ACE'),
      T(MA, 'slide 33', 'Increases water reabsorption'),
    ],
    model: 'Reproduced from her own model answer, including the direct/indirect split she uses. Her RAAS summary table names each molecule, where it comes from and what it causes.',
  },

  /* ═══ CASE STUDY 5 — VACCINATION AND IMMUNISATION ═════════════════════════ */
  {
    type: 'saq', topic: 'immune', crit: 'cs-vacc', tier: 'verbatim', marks: 4,
    ev: { src: WB, loc: 'para 107', quote: 'Where in the body are B- and T- lymphocytes made and stored? Be specif' },
    q: 'Where in the body are B- and T- lymphocytes made and stored? Be specific! (4 marks)',
    pointsTier: 'mixed',
    points: [
      'Both B and T lymphocytes are MADE in the red bone marrow',
      'B lymphocytes MATURE in the bone marrow',
      'T lymphocytes MATURE in the THYMUS, which activates them to become immunocompetent T-cells before they move on to the other lymphoid organs',
      'Once mature they are STORED in the lymphoid organs — lymph nodes, spleen and lymphoid tissue, which house them and provide proliferation and surveillance sites',
    ],
    pointEv: [
      B('Her material names where each cell MATURES but never states that both lines originate in red bone marrow — standard haematology, not taught here.'),
      T(CSMA, 'slide 2', 'bone marrow (b cell maturing)'),
      T(LY, 'slide 21', 'T-lymphocytes mature in the thymus'),
      T(LY, 'slide 23', 'Houses and provides | proliferation sites | for lymphocytes'),
    ],
  },
  {
    type: 'saq', topic: 'immune', crit: 'cs-vacc', tier: 'verbatim', marks: 3,
    ev: { src: WB, loc: 'para 108', quote: 'What is the structure of a lymph nodes, and what is found in lymph nodes?' },
    q: 'What is the structure of a lymph nodes, and what is found in lymph nodes? (3 marks)',
    pointsTier: 'taught',
    points: [
      'A lymph node is enclosed in a FIBROUS CAPSULE',
      'Inside it contains masses of LYMPHOCYTES and MACROPHAGES',
      'It is a site of high immune-cell activity, where the cells of the immune system interact to create and coordinate an immune response',
    ],
    pointEv: [
      T(LY, 'slide 22', 'within a | fibrous capsu'),
      T(LY, 'slide 22', 'Contain masses of lymphocytes and macrophages'),
      T(CSMA, 'slide 2', 'cells of the immune system interact to create and coordinate an immune response'),
    ],
  },
  {
    type: 'saq', topic: 'immune', crit: 'cs-vacc', tier: 'verbatim', marks: 2,
    ev: { src: WB, loc: 'para 109', quote: 'Which cells in the body will find antigens in the body?' },
    q: 'Which cells in the body will find antigens in the body? (2 marks)',
    pointsTier: 'taught',
    points: [
      'MACROPHAGES and B LYMPHOCYTES collect antigens in the tissue fluid',
      'These are the ANTIGEN PRESENTING CELLS — the cells that find antigens in the first instance',
    ],
    pointEv: [
      T(REV, 'slide 12', 'Macrophages and B lymphocytes collect'),
      T(CAP, 'slide 20', 'antigen presenting cells (those cells that find antigens in the first'),
    ],
  },
  {
    type: 'saq', topic: 'immune', crit: 'cs-vacc', tier: 'verbatim', marks: 3,
    ev: { src: WB, loc: 'para 110', quote: 'Which cells will stimulate a full on immune response against an antigen, and how' },
    q: 'Which cells will stimulate a full on immune response against an antigen, and how? (3 marks)',
    pointsTier: 'taught',
    points: [
      'The antigen presenting cells PRESENT the antigen to T-CELLS, which organise the immune system',
      'T cells are the cells that kick off the immune response',
      'B cells then form ANTIBODIES, which defend against that specific antigen',
    ],
    pointEv: [
      T(REV, 'slide 12', 'Present antigens to'),
      T(CAP, 'slide 20', 'T cells – those cells that can kick off an immune response'),
      T(REV, 'slide 12', 'B cells will form antibodies'),
    ],
  },
  {
    type: 'saq', topic: 'immune', crit: 'cs-vacc', tier: 'verbatim', marks: 4,
    ev: { src: WB, loc: 'para 111', quote: 'How does vaccination work? How does the COVID-19 vaccine wor' },
    q: 'How does vaccination work? How does the COVID-19 vaccine work? (4 marks)',
    pointsTier: 'mixed',
    points: [
      'Adaptive/acquired immunity is driven by EXPOSURE TO ANTIGENS — either by getting an infection, or by vaccination',
      'A vaccine presents the antigen WITHOUT the live disease-causing pathogen, so the immune system does a practice run: the antigen is presented to T cells, B cells make antibodies, and memory cells are stored',
      'On later exposure the stored MEMORY CELLS mount a faster, larger response, usually clearing the pathogen before symptoms appear',
      'The COVID-19 mRNA vaccine delivers mRNA coding for the spike protein; the body’s own cells make that protein, which is then treated as the antigen. It does not contain live virus and does not enter or alter DNA',
    ],
    pointEv: [
      T(CAP, 'slide 19', 'Adaptive/Acquired immunity is driven by exposure to antigens (either by getting a infection or by vaccination)'),
      T(WB, 'para 106', 'Vaccination works by stimulating the immune system'),
      T(CAP, 'slide 19', 'Immunisation happens when the immune system stored memory cells to help it mount a faster immun'),
      B('She asks how the COVID-19 vaccine works but no lecturer source in the corpus describes the mRNA mechanism. Standard, well-established immunology, written for this pack — expect to be marked on the principle rather than the detail.'),
    ],
  },
  {
    type: 'saq', topic: 'immune', crit: 'cs-vacc', tier: 'verbatim', marks: 2,
    ev: { src: WB, loc: 'para 112', quote: 'What is the difference between vaccination and immunisation?' },
    q: 'What is the difference between vaccination and immunisation? (2 marks)',
    pointsTier: 'taught',
    points: [
      'VACCINATION is the act — being given the antigen, one of the two routes to acquired immunity alongside catching the infection',
      'IMMUNISATION is the RESULT — it happens when the immune system has stored memory cells that let it mount a faster response to a future infection',
    ],
    pointEv: [
      T(CAP, 'slide 19', 'either by getting a infection or by vaccination'),
      T(CAP, 'slide 19', 'Immunisation happens when the immune system stored memory cells'),
    ],
  },
];
