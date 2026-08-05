/* Phase 4 item 5 — map her harvested questions onto the 36 blueprint criteria, then
   RECOMPUTE the blind list from what she actually tests.

   The current pack's "8 blind criteria" claim was made before any of her quizzes were
   captured. It is inherited, not measured. This recomputes it: a criterion is blind only
   if none of her 236 captured questions touches it.

   Matching rules are declared per criterion, by hand, from the criterion's own wording in
   ASSESSMENT CRITERIA.docx. Nothing is inferred from the card. A card that matches no
   rule is left UNMAPPED and reported rather than being filed somewhere plausible. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loadPack } from './load-pack.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const { pack } = loadPack();
const { BOUND } = await import(pathToFileURL(path.join(HERE, 'harvested-bound.js')).href);

/* [criterion id, pattern]. Written from her criterion wording, deliberately specific:
   a loose rule that maps everything would make the blind list look better than it is,
   which is the exact failure this recomputation exists to correct.

   EVERY BARE WORD HERE NEEDS \b AROUND IT. Three of these rules originally did not
   have it, and a regex alternative with no word boundary matches inside other words:
     cvs-10  `age`      matched pass|im|cartil|percent|c|dam-age  — 49 "her questions"
                        on that criterion, of which 47 were the word "passage"
     cvs-7   `lub`      matched so-lub-ility, so two gas-solubility questions were
                        filed under Heart sounds
     cvs-5   `chamber`  matched "hyperbaric chambers"
   Nothing about that is visible in the output — the counts just come out too high and
   crits[0] becomes the card's displayed focus point. selfTest() below now asserts that
   none of these rules fires on a control string. Add a control whenever you add a rule. */
const RULES = [
  ['cvs-1',  /function of the (cardiovascular|circulatory)|why do we (need|have) a (heart|circulation)/i],
  ['cvs-2',  /\b(artery|arteries|vein|veins|capillar\w+)\b.*\b(structure|differen|wall|tunica|lumen|compare)|\b(tunica|IEL|internal elastic lamina)\b|which vessel|vessel type/i],
  ['cvs-3',  /hydrostatic|oncotic|osmotic pressure|osmolality|capillary (exchange|fluid)|filtration|reabsorption|oedema|edema/i],
  ['cvs-4',  /peripheral resistance|\bPR\b.*\bBP\b|\bSVR\b|blood flow.*velocity|velocity.*blood|viscosity|vessel (radius|diameter).*(resistance|flow)|normal BP.*(arteries|arterioles|capillaries)/i],
  ['cvs-5',  /pericardi|epicardi|myocardi|endocardi|heart wall|\bchambers? of the heart\b|heart chamber|atri\w+|ventricl\w+|septum|valve|papillary|chordae|apex of the heart|heart is located|pectinate|trabecul|fibrous material on the outside of the heart/i],
  ['cvs-6',  /blood flow through|pulmonary (circuit|circulation)|systemic (circuit|circulation)|coronary (artery|arteries|circulation)|route of the|widow maker|foramen ovale|ductus|arch of the aorta|descending aorta|hepatic portal|inferior vena cava|superior vena cava|major (artery|blood vessels)|interventricular artery|circumflex|deoxygenated blood to the lungs/i],
  ['cvs-7',  /heart sound|\bS1\b|\bS2\b|\blub\b|\bdub\b|lub-?dub|murmur|auscultat|phono-?cardiogram/i],
  ['cvs-8',  /\bECG\b|EKG|P wave|QRS|T wave|SA node|AV node|sinoatrial|atrioventricular node|bundle of His|Purkinje|conduction system|cardiac cycle|automaticity|depolaris|repolaris/i],
  ['cvs-9',  /cardiac output|stroke volume|\bCO = |heart rate.*control|sympathetic.*heart|parasympathetic.*heart|vagus|inotropic|chronotropic/i],
  ['cvs-10', /factors? affecting (heart rate|stroke volume|cardiac output)|\bages?\b|temperature.*heart rate/i],
  ['cvs-11', /venous return|preload|afterload|Frank-?Starling|electrolyte.*(cardiac|heart)|potassium.*heart|exercise.*(cardiac|heart)/i],
  ['cvs-12', /baroreceptor|vasomotor|renin|angiotensin|aldosterone|\bADH\b|antidiuretic|blood pressure.*(control|regulat)|regulat.*blood pressure/i],
  ['cvs-13', /stress.*blood pressure|exercise.*blood pressure|blood pressure.*exercise/i],
  ['cvs-14', /\bshock\b|hypovolaem|hypovolem|cardiogenic|anaphylactic|septic shock|distributive/i],
  ['cvs-15', /pulse|tissue perfusion|vasoconstrict|vasodilat|ischaem|ischem|myocardial infarction|angina|bradycard|tachycard|hypertens|hypotens|pericarditis|myocarditis|endocarditis|fibrillation|asystole/i],

  ['resp-1',  /processes of respiration|pulmonary ventilation|external respiration|internal respiration|cellular respiration|four (processes|stages)|metabolic reason.*respiration/i],
  ['resp-2',  /\bnose\b|nasal|sinus|pharyn|laryn|trache|bronch|pleura|lung.*(lobe|anatomy|tissue)|respiratory tract anatomy|sizes of the two lungs|pneumonia/i],
  ['resp-3',  /conducting zone|respiratory zone|upper respiratory|lower respiratory/i],
  ['resp-4',  /pathway of air|air pass|muco-?cili|cilia|vibrissae|cough|sneeze|carina|sound production|vocal/i],
  ['resp-5',  /alveol\w+|surfactant|respiratory membrane|type (I|II|1|2) (cell|pneumocyte)|surface tension/i],
  ['resp-6',  /lung volume|lung capacit|tidal volume|residual volume|vital capacity|inspiratory reserve|expiratory reserve|spirometr|\bFRC\b|\bTLC\b|peak flow/i],
  ['resp-7',  /Boyle|intrapleural|intrapulmonary|pressure.*volume change|airway resistance|compliance|pneumothorax|atelectasis|bell jar|accessory muscles|forced (breathing|exhalation|inspiration)/i],
  ['resp-8',  /atmospheric air|alveolar air|partial pressure|Dalton|composition of.*air|total atmospheric pressure/i],
  ['resp-9',  /external respiration|pulmonary gas exchange|gas exchange.*(alveol|lung)|diffusion.*(alveol|membrane)/i],
  ['resp-10', /internal respiration|tissue gas exchange|gas exchange.*tissue/i],
  ['resp-11', /oxygen transport|oxyhaemoglobin|oxyhemoglobin|h[ae]moglobin|dissociation curve|Bohr|heme group|affinity for which/i],
  ['resp-12', /carbon dioxide transport|bicarbonate|carbamino|carbonic anhydrase|chloride shift/i],
  ['resp-13', /respiratory centre|respiratory center|medulla|pons|\bDRG\b|\bVRG\b|pontine|basic rhythm/i],
  ['resp-14', /chemoreceptor|\bpH\b.*(ventilation|respiration|breathing)|PCO2.*ventilation|hypercapn|hypoxi[ac]|acidosis|alkalosis|ketoacidosis|urge to breathe|acid.?base buffer/i],
  ['resp-15', /emotion|conscious control|voluntary.*breath|hypothalam.*breath|cortical.*breath|anxiety|panic/i],
  ['resp-16', /exercise.*ventilation|body temperature.*breath|pain.*breath|irritation.*airway|hyperpnoea/i],
  ['resp-17', /asthma|bronchitis|emphysema|tuberculosis|bronchodilator|dyspnoea|apnoea|eupnoea|tachypnoea|hyperventilat|hypoventilat|hypocapn|cyanosis/i],

  ['lymph-1', /function.*lymphatic|lymphatic.*function|immune|body defence|lipid absorption|fluid (volume|balance)/i],
  ['lymph-2', /lymph node|lymphatic (capillar|vessel|duct)|thoracic duct|cisterna chyli|spleen|thymus|tonsil|Peyer|subclavian vein|lacteal/i],
  ['lymph-3', /lymph.*(return|drain).*(blood|venous|cardiovascular)|relationship between.*lymphatic|lymph flows towards|thoracic (duct|cavity).*lymph|lymph.*pressure created/i],
  ['lymph-4', /bubo|lymphoedema|lymphedema|lymphangitis|Hodgkin|splenectomy|tonsillitis|sentinel node|swollen gland|ruptured spleen|adenitis/i],

  ['cs-bp',   /case study.*blood pressure|Lagi|blood pressure.*scenario/i],
  ['cs-vacc', /vaccin|immunis|immuniz|antigen|antibod|lymphocyte|B cell|T cell|memory cell|dendritic|macrophage|plasma cell/i],
];

const textOf = (c) => JSON.stringify({ q: c.q, text: c.text, options: c.options, pairs: c.pairs, statements: c.statements, blanks: c.blanks });

/* ── the gate the rules above needed and did not have ─────────────────────────
   Wording that is pure scaffolding, plus the near-misses that actually bit. None of
   it names any physiology, so NO rule may fire on it. A bare word in an alternation
   silently matches inside longer words, and the only symptom downstream is a count
   that looks healthy — so this runs before the mapping, not after it. */
const CONTROLS = [
  'Complete the passage.', 'Complete the passage. (MODULE 1)', 'Study the images and answer the questions',
  'Identify the structures in the image below', 'Match the following', 'Choose all that apply',
  'the cartilage', 'its percentage', 'the rib cage', 'lung damage', 'the average',
  'solubility in water', 'a hyperbaric chamber', 'Select the correct answer',
];
const leaks = [];
for (const s of CONTROLS) {
  const t = textOf({ q: s });
  for (const [id, re] of RULES) if (re.test(t)) leaks.push(`"${s}" wrongly matches ${id} on ${JSON.stringify(String(t.match(re)[0]))}`);
}
if (leaks.length) {
  console.error('✗ criterion rules match text that names no physiology:');
  for (const l of leaks) console.error('    ' + l);
  console.error('\n  Put \\b around the bare word. See the note above the rule table.');
  process.exit(1);
}

const mapped = [];
const unmapped = [];
for (const c of BOUND) {
  const t = textOf(c);
  const hits = RULES.filter(([, re]) => re.test(t)).map(([id]) => id);
  if (hits.length) mapped.push({ card: c, crits: hits });
  else unmapped.push(c);
}

/* ── coverage from HER questions ─────────────────────────────────────────── */
const herCount = {};
for (const m of mapped) for (const id of m.crits) herCount[id] = (herCount[id] ?? 0) + 1;

const criteria = pack.criteria ?? [];
const nowBlind = [];
const wasBlindNowCovered = [];
for (const crit of criteria) {
  const n = herCount[crit.id] ?? 0;
  if (n === 0) nowBlind.push(crit);
  else if (crit.blind) wasBlindNowCovered.push({ ...crit, n });
}

fs.writeFileSync(path.join(HERE, 'criteria-map.json'), JSON.stringify({
  herCount, nowBlind: nowBlind.map(c => c.id), wasBlindNowCovered: wasBlindNowCovered.map(c => ({ id: c.id, n: c.n })),
  unmapped: unmapped.map(c => ({ quiz: c.ev.quiz, n: c.ev.n, type: c.type, q: (c.q ?? '').slice(0, 90) })),
  mapped: mapped.map(m => ({ quiz: m.card.ev.quiz, n: m.card.ev.n, crits: m.crits })),
}, null, 1));

console.log('══ CRITERIA MAP ════════════════════════════════════');
console.log(`  ${BOUND.length} harvested cards · ${mapped.length} mapped · ${unmapped.length} unmapped`);
console.log(`  (a card may serve more than one criterion; ${Object.values(herCount).reduce((a, b) => a + b, 0)} card-criterion links)\n`);

console.log(`  HER QUESTIONS NOW COVER ${criteria.length - nowBlind.length} of ${criteria.length} criteria.\n`);
if (wasBlindNowCovered.length) {
  console.log('  ── previously flagged BLIND, now covered by her own questions ──');
  for (const c of wasBlindNowCovered.sort((a, b) => b.n - a.n)) {
    console.log(`    ${String(c.n).padStart(3)} question(s)  ${c.id.padEnd(9)} ${c.name ?? ''}`);
  }
}
console.log('\n  ── still blind: no captured question of hers touches these ──');
for (const c of nowBlind) console.log(`    ${c.blind ? '(was flagged)' : '(NEWLY blind)'.padEnd(13)} ${c.id.padEnd(9)} ${c.name ?? ''}`);

const thin = criteria.filter(c => (herCount[c.id] ?? 0) > 0 && (herCount[c.id] ?? 0) < 3);
if (thin.length) {
  console.log('\n  ── thin: 1-2 of her questions only ──');
  for (const c of thin) console.log(`    ${String(herCount[c.id]).padStart(3)}  ${c.id.padEnd(9)} ${c.name ?? ''}`);
}
if (unmapped.length) {
  console.log(`\n  ${unmapped.length} card(s) matched no criterion rule — reported, not guessed:`);
  for (const c of unmapped.slice(0, 8)) console.log(`    [${c.type}] ${(c.q ?? '').slice(0, 76)}`);
  if (unmapped.length > 8) console.log(`    … and ${unmapped.length - 8} more in criteria-map.json`);
}
console.log('\nwrote audit/criteria-map.json');
