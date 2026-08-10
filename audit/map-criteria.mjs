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
  /* BOTH DIRECTIONS. The rule read vessel-then-structure only, so "the WALLS of the VEINS
     are too thin" and "the WALLS of the CAPILLARIES in the bone marrow" missed it — one of
     them the card whose whole subject is capillary types, which would have lost cvs-2 as
     its primary the moment the unbounded `.*` was tightened. English puts the possessed
     noun either side of the possessor; a rule that only reads one order is half a rule. */
  ['cvs-2',  /\b(artery|arteries|vein|veins|capillar\w+)\b[^"]{0,60}\b(structure|differen|wall|tunica|lumen|compare)|\b(structure|differen|wall|tunica|lumen|compare)\w*\b[^"]{0,60}\b(artery|arteries|vein|veins|capillar\w+)\b|\b(tunica|IEL|internal elastic lamina)\b|which vessel|vessel type/i],
  /* TWO GUARDS, both of which were live defects.

     `oedema` is bounded by  so it cannot match inside LYMPHoedema — lymph-4's own word,
     which was pulling the lymphatic terminology quiz into capillary fluid movement and is
     the accident that left lymph-4 with no card of its own. A lookbehind for "lymph" was
     tried first and is not enough: in "lymphoedema" the substring `edema` is preceded by
     "lympho", so it slipped straight past. The word boundary handles both spellings and
     both prefixes at once.

     `filtration` and `reabsorption` now need a capillary or the tissue fluid beside them.
     Bare, they are renal words as often as capillary ones, and they had filed the RAAS
     table, "describe the direct renal control of BP" and "the filtration membrane in the
     kidney" under capillary fluid movement — three of them ahead of the card that IS this
     criterion ("the forces acting across a blood capillary") in the queue. */
  ['cvs-3',  /hydrostatic|oncotic|osmotic pressure|osmolality|capillary (exchange|fluid)|(filtration|reabsorption|absorption)[^"]{0,70}(capillar|tissue fluid|interstiti)|(capillar|tissue fluid|interstiti)[^"]{0,70}(filtration|reabsorption)|net filtration|\b(oedema|edema)\b/i],
  /* `pressure is the highest/lowest …` is added for the HEART ANATOMY true/false that
     states the pressure gradient from aorta to venae cavae. It is guarded by a vessel
     word within 90 characters because the identical phrasing is how PARTIAL pressures
     are stated all through the respiratory decks — "the partial pressure of oxygen is
     highest in the alveoli" is resp-8, not blood pressure. */
  ['cvs-4',  /peripheral resistance|\bPR\b[^"]{0,60}\bBP\b|\bBP\b[^"]{0,60}\bPR\b|\bSVR\b|blood flow[^"]{0,60}velocity|velocity[^"]{0,60}blood|viscosity|vessel (radius|diameter)[^"]{0,60}(resistance|flow)|normal BP[^"]{0,60}(arteries|arterioles|capillaries)|pressure is (the )?(highest|lowest)[^"]{0,90}(arteries|arterioles|capillar|ven[ae]|veins)/i],
  ['cvs-5',  /pericardi|epicardi|myocardi|endocardi|heart wall|\bchambers? of the heart\b|heart chamber|atri\w+|ventricl\w+|septum|valve|papillary|chordae|apex of the heart|heart is located|pectinate|trabecul|fibrous material on the outside of the heart/i],
  /* Two alternatives added 11 Aug 2026 for the CVS4 BLOOD PRESSURE capture:
     `double circulation` / `closed and double` is her own slide-3 wording for what the
     human circulation IS — two circuits, blood never leaving the vessels — and that slide
     is this criterion, not cvs-1 (her slide 2 is the FUNCTIONS: transport, pumping,
     protection). `aortic arch` is deliberately NOT bare: the arch is named on every
     baroreceptor card in the pack ("baroreceptors in the aortic arch and carotid sinus"),
     and a bare alternative would have tagged the whole BP reflex family as circuit
     anatomy. It fires only when a branch of the arch is named beside it. */
  ['cvs-6',  /blood flow through|pulmonary (circuit|circulation)|systemic (circuit|circulation)|coronary (artery|arteries|circulation)|route of the|widow maker|foramen ovale|ductus|arch of the aorta|descending aorta|hepatic portal|inferior vena cava|superior vena cava|major (artery|blood vessels)|interventricular artery|circumflex|deoxygenated blood to the lungs|double circulation|closed and double|aortic arch[^"]{0,90}brachiocephalic/i],
  ['cvs-7',  /heart sound|\bS1\b|\bS2\b|\blub\b|\bdub\b|lub-?dub|murmur|auscultat|phono-?cardiogram/i],
  ['cvs-8',  /\bECG\b|EKG|P wave|QRS|T wave|SA node|AV node|sinoatrial|atrioventricular node|bundle of His|Purkinje|conduction system|cardiac cycle|automaticity|depolaris|repolaris/i],
  /* `vagus` needs heart context. Bare, it fired on "The nerve that excites the diaphragm
     … is the" — a PHRENIC nerve question whose third distractor is "vagus nerve" — and
     filed it under Cardiac output, so a respiratory card displayed a cardiovascular
     focus point. The vagus does far more than the heart; only the cardiac half is
     cvs-9. The one card that reaches cvs-9 through this rule alone and SHOULD (the
     Module 1 formative passage) names the heart in the same breath and still matches. */
  ['cvs-9',  /cardiac output|stroke volume|\bCO = |heart rate[^"]{0,60}control|sympathetic[^"]{0,90}heart|parasympathetic[^"]{0,90}heart|vagus[^"]{0,70}(heart|cardiac|SA node|AV node|atria|rate)|(heart|cardiac|SA node|AV node|atria)[^"]{0,70}vagus|inotropic|chronotropic|cardio-?accelerat|cardio-?inhibit/i],
  /* Her own slide for this criterion is the "Effect of general factors on heart rate,
     stroke volume & cardiac output" table — exercise, fever, ageing, dehydration, stress,
     hypertension — and slide 28's "Variations in heart rate" adds gender and age. Fitness
     is the same kind of factor and the CVS4 quiz asks it directly, so `trained`/`athlete`
     joins the list. Both alternatives require `heart rate` within 70 characters: bare,
     `trained` would have taken the "BLOOD VESSELS AS AN IMPORTANT PART OF YOUR TRAINING"
     discussion board and every card harvested near it. */
  ['cvs-10', /factors? affecting (heart rate|stroke volume|cardiac output)|\bages?\b|temperature[^"]{0,60}heart rate|(trained|athlete)[^"]{0,70}heart rate|heart rate[^"]{0,70}(trained|athlete)/i],
  ['cvs-11', /venous return|preload|afterload|Frank-?Starling|electrolyte[^"]{0,60}(cardiac|heart)|potassium[^"]{0,60}heart|(?<!matching )exercise[^"]{0,60}(cardiac|heart)/i],
  ['cvs-12', /baroreceptor|vasomotor|renin|angiotensin|aldosterone|\bADH\b|antidiuretic|blood pressure[^"]{0,60}(control|regulat)|regulat[^"]{0,60}blood pressure|cardiac cent(re|er)|senses? the blood pressure|(control|regulat)\w*[^"]{0,40}\bBP\b|\bBP\b[^"]{0,40}(control|regulat)/i],
  ['cvs-13', /stress[^"]{0,60}blood pressure|(?<!matching )exercise[^"]{0,60}blood pressure|blood pressure[^"]{0,60}(?<!matching )exercise/i],
  ['cvs-14', /\bshock\b|hypovolaem|hypovolem|cardiogenic|anaphylactic|septic shock|distributive/i],
  ['cvs-15', /pulse|tissue perfusion|vasoconstrict|vasodilat|ischaem|ischem|myocardial infarction|angina|bradycard|tachycard|hypertens|hypotens|pericarditis|myocarditis|endocarditis|fibrillation|asystole/i],

  /* `external respiration` and `internal respiration` were here and are GONE. resp-9 and
     resp-10 exist for exactly those two processes, but resp-1 is listed first, so it won
     every time and the specific criterion could never be the one displayed: "External
     respiration is affected by all of the following factors except" showed up under
     "Function of the respiratory system and the four processes" rather than under
     "External respiration and the factors affecting gas exchange", which is the criterion
     that names what the question is testing.

     resp-1 keeps the wording that is about NAMING the four processes — "pulmonary
     ventilation is also known as" is still its question. Three cards move, each to the
     criterion that already listed it as an alsoCrit, so no coverage is lost and resp-10
     (the thinnest respiratory point) gains one. */
  ['resp-1',  /processes of respiration|pulmonary ventilation|cellular respiration|four (processes|stages)|metabolic reason[^"]{0,60}respiration/i],
  /* `sinus` WAS BARE HERE AND HAS NEVER ONCE DONE ITS JOB. It is in the rule for the
     paranasal sinuses, which criterion 2 names — and not one of Hannetjie's 376 harvested
     questions says "paranasal" or "sinusitis". What it matched instead was the CAROTID
     sinus, the CORONARY sinus and sinusoidal capillaries: 12 cardiovascular cards, every
     baroreflex card in the pack among them, each carrying a respiratory-anatomy tag it
     had no business with. The whole "describe the neural mechanisms regulating blood
     pressure" family was filed as partly respiratory because of five letters.

     Caught by a control string, four months after the same mistake was documented three
     lines up for `age`, `lub` and `chamber`. `nasal` still covers "nasal sinuses" if she
     ever asks; `paranasal` is her own word from the criterion. */
  ['resp-2',  /\bnose\b|nasal|paranasal|sinusitis|pharyn|laryn|trache|bronch|pleura|lung[^"]{0,60}(lobe|anatomy|tissue)|respiratory tract anatomy|sizes of the two lungs|pneumonia/i],
  ['resp-3',  /conducting zone|respiratory zone|upper respiratory|lower respiratory/i],
  ['resp-4',  /pathway of air|air pass|muco-?cili|cilia|vibrissae|cough|sneeze|carina|sound production|vocal/i],
  /* `penumocyte` is HER spelling, on the Blood-Carrying-Gases true/false. Spelt out as
     its own alternative rather than fuzzed, the same way `hypovolaem|hypovolem` and
     `ischaem|ischem` are: a rule that guesses at misspellings starts matching words
     nobody wrote. */
  ['resp-5',  /alveol\w+|surfactant|respiratory membrane|type (I|II|1|2) (cell|pneumocyte)|surface tension|p(?:neu|enu)mocyte/i],
  /* `lung capacit` did not reach "The RESPIRATORY capacities are a combined of 2 or more
     volumes", which is how the Practice Lab 2 spirometry question opens — the only card in
     the pack that asks the reader to read a spirometer trace. `respiratory capacit` and the
     capacity's full name are both hers. */
  ['resp-6',  /lung volume|lung capacit|respiratory capacit|functional residual capacity|tidal volume|residual volume|vital capacity|inspiratory reserve|expiratory reserve|spirometr|\bFRC\b|\bTLC\b|peak flow/i],
  /* The Gas-Laws quiz states ventilation mechanics as four true/false claims about quiet
     and forced breathing — "Quiet expiration is a passive process involving mainly
     elastic recoil" — and none of the wording above reaches them. `forced inhalation` is
     added alongside the existing `forced inspiration` because she uses both words. */
  ['resp-7',  /Boyle|intrapleural|intrapulmonary|pressure[^"]{0,60}volume change|airway resistance|compliance|pneumothorax|atelectasis|bell jar|accessory muscles|forced (breathing|exhalation|inspiration|inhalation)|quiet (inspiration|expiration|breathing)|elastic recoil|intercostal/i],
  ['resp-8',  /atmospheric air|alveolar air|partial pressure|Dalton|composition of[^"]{0,60}air|total atmospheric pressure|\bin the atmosphere\b/i],
  ['resp-9',  /external respiration|pulmonary gas exchange|gas exchange[^"]{0,60}(alveol|lung)|diffusion[^"]{0,60}(alveol|membrane)/i],
  ['resp-10', /internal respiration|tissue gas exchange|gas exchange[^"]{0,60}tissue/i],
  /* `h[ae]moglobin` is one character class and "haemoglobin" needs two — so the rule has
     only ever matched the AMERICAN spelling, and every question of hers written the
     British way fell through to no criterion at all. It is the same failure mode as the
     missing `\b` documented above: nothing is visible in the output except a count that
     comes out low. `ha?emoglobin` matches both.

     The bare form is guarded against `carbamino`, which is the CO₂-bound molecule and
     belongs to resp-12. Without that, "The majority of carbon dioxide is transported"
     matched resp-11 on its own distractor — and because resp-11 is listed first, a
     carbon-dioxide question displayed "Transport of oxygen in the blood". `carboxy` is
     deliberately NOT guarded: that one is about the oxygen-carrying site. `carbino` is
     guarded alongside it because that is how the practice test spells carbamino — the
     same reason `penumocyte` is spelt out above. Without it, "The majority of carbon
     dixoide is transported" displayed "Transport of oxygen in the blood". */
  ['resp-11', /oxygen transport|oxyha?emoglobin|(?<!carbamino)(?<!carbino)ha?emoglobin|dissociation curve|Bohr|heme group|haeme group|affinity for which/i],
  ['resp-12', /carbon dioxide transport|bicarbonate|carbamino|carbonic anhydrase|chloride shift/i],
  ['resp-13', /respiratory centre|respiratory center|medullary respiratory|medulla[^"]{0,70}(respirat|breath|ventilat|inspir|expir)|(respirat|breath|ventilat|inspir|expir)[^"]{0,70}medulla|\bpons\b[^"]{0,70}(respirat|breath|ventilat)|(respirat|breath|ventilat)[^"]{0,70}\bpons\b|\bDRG\b|\bVRG\b|pontine|basic rhythm|pulmonary inflation reflex|Hering-?Breuer/i],
  /* Her Blood-Carrying-Gases quiz opens with six acid-base items that never say
     "acidosis": they say "Normal blood pH is", "Blood with a pH of 7 is", and put
     `acidotic`/`alkalotic` in the options. Same chemistry, different part of speech. */
  ['resp-14', /chemoreceptor[^"]{0,90}(ventilat|breath|respirat|CO2|CO₂|carbon dioxide|oxygen|\bO2\b|\bpH\b)|(ventilat|breath|respirat|carbon dioxide|oxygen)[^"]{0,90}chemoreceptor|\bpH\b[^"]{0,60}(ventilation|respiration|breathing)|blood pH|\bpH of\b|acidotic|alkalotic|PCO2[^"]{0,60}ventilation|hypercapn|hypoxi[ac]|acidosis|alkalosis|ketoacidosis|urge to breathe|acid.?base buffer/i],
  ['resp-15', /emotion|conscious control|voluntary[^"]{0,60}breath|hypothalam[^"]{0,60}breath|cortical[^"]{0,60}breath|anxiety|panic/i],
  ['resp-16', /(?<!matching )exercise[^"]{0,60}ventilation|body temperature[^"]{0,60}breath|pain[^"]{0,60}breath|irritation[^"]{0,60}airway|hyperpnoea/i],
  ['resp-17', /asthma|bronchitis|emphysema|tuberculosis|bronchodilator|dyspnoea|apnoea|eupnoea|tachypnoea|hyperventilat|hypoventilat|hypocapn|cyanosis/i],

  ['lymph-1', /function[^"]{0,60}lymphatic|lymphatic[^"]{0,60}function|immune|body defence|lipid absorption|fluid (volume|balance)/i],
  ['lymph-2', /lymph node|lymphatic (capillar|vessel|duct)|thoracic duct|cisterna chyli|spleen|thymus|tonsil|Peyer|subclavian vein|lacteal/i],
  ['lymph-3', /lymph[^"]{0,60}(return|drain)[^"]{0,60}(blood|venous|cardiovascular)|relationship between[^"]{0,60}lymphatic|lymph flows towards|thoracic (duct|cavity)[^"]{0,60}lymph|lymph[^"]{0,60}pressure created/i],
  ['lymph-4', /bubo|lymphoedema|lymphedema|lymphangitis|Hodgkin|splenectomy|tonsillitis|sentinel node|swollen gland|ruptured spleen|adenitis/i],

  ['cs-bp',   /case study[^"]{0,60}blood pressure|Lagi|blood pressure[^"]{0,60}scenario/i],
  ['cs-vacc', /vaccin|immunis|immuniz|antigen|antibod|lymphocyte|\bB cells?\b|\bT cells?\b|memory cell|dendritic|macrophage|plasma cell/i],
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
  /* Controls for the alternatives added 6 Aug 2026 with the three Module 1.2 captures.
     Each is the near-miss its own rule could plausibly have swallowed — an atmosphere
     that is not the air's composition, a "ph of" inside another word, a quiet that is
     not a breath, elastic that is not recoil, and the bleed that sits two letters from
     haemoglobin. (`pneumonia` was tried here and is not a control: resp-2 matches it on
     purpose, which is the list working.) */
  'a relaxed atmosphere in the ward', 'the graph of blood flow over time',
  'the patient was quiet and settled', 'elastic stockings', 'a haemorrhage',
  /* Controls for the five alternatives added 11 Aug 2026 with the CVS4 BLOOD PRESSURE and
     Practice Lab 2 captures. Each is the near-miss the new alternative was written to
     avoid: the arch named as a baroreceptor site rather than as the root of the great
     arteries, a partial pressure stated in the same words as a blood pressure, the
     training that is a nursing course rather than an athlete's, and a capacity that is
     not a lung's. */
  'the aortic arch and the carotid sinus', 'pressure is the highest at sea level',
  'students trained in the lab', 'the capacity of the ward', 'a closed and sterile field',
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

const ruleHits = new Map();
for (const c of BOUND) {
  const t = textOf(c);
  ruleHits.set(c, RULES.filter(([, re]) => re.test(t)).map(([id]) => id));
}

/* ── declared routing, per question ───────────────────────────────────────────
   THE RULE TABLE CANNOT REACH EVERY QUESTION, and pretending otherwise is how it
   would get loosened until it files things by accident. Five of her questions name no
   physiology at all because the physiology is in an image — "The white shiny part of
   this structure labelled at A", "The structure labelled at B is a" — and a rule broad
   enough to catch those would catch half the pack.

   The other thing this file fixes is WHICH criterion is first. `crits[0]` becomes the
   card's `crit`, which is the focus point the reader is shown and the one Ring 0 deals,
   and until now it was decided by the order of the rule table. That is fine when a card
   touches one point and arbitrary when it touches eight: the lymphatic terminology
   matching exercise — buboes, lymphoedema, Hodgkin's — was filed under cvs-3, capillary
   fluid movement, because `oedema` is inside `lymphoedema` and cvs-3 is declared earlier.

   Every entry is proven to still bite (see the gates below). An entry that has stopped
   matching, or that no longer changes anything, fails the build instead of rotting. */
const ROUTES = JSON.parse(fs.readFileSync(path.join(HERE, 'routes.json'), 'utf8')).routes ?? [];
/* `[[IMG:…]]` markers are stripped before comparing: harvest.mjs checks the same `was`
   against the pre-bind card, which still carries the marker, and this script checks it
   against the bound card, where bind-images has replaced it. One anchor has to satisfy
   both, and the anchor is a claim about the WORDS of the question, not about which phase
   of the pipeline has run. */
const norm = (s) => String(s ?? '').replace(/\[\[IMG[^\]]*\]\]/g, ' ').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
{
  const problems = [];
  const seen = new Set();
  for (const r of ROUTES) {
    const at = `${r.quiz} ${r.n}`;
    if (seen.has(at)) { problems.push(`${at}: listed twice`); continue; }
    seen.add(at);
    const hits = BOUND.filter((c) => c.ev?.quiz === r.quiz && c.ev?.n === r.n);
    if (hits.length !== 1) { problems.push(`${at}: addresses ${hits.length} harvested cards, needs exactly 1`); continue; }
    const c = hits[0];
    /* The anchor. It is the only guard a human can read, and it is what catches a route
       still pointing at question 9 after question 9 became a different question. */
    if (!norm(c.q).startsWith(norm(r.was))) {
      problems.push(`${at}: anchor does not open this card's question.\n        want: ${norm(r.was).slice(0, 90)}\n        got : ${norm(c.q).slice(0, 90)}`);
      continue;
    }
    const before = ruleHits.get(c);
    let next = [...before];
    for (const id of r.drop ?? []) {
      if (!before.includes(id)) { problems.push(`${at}: drops ${id}, which no rule put on this card`); continue; }
      next = next.filter((x) => x !== id);
    }
    for (const id of r.add ?? []) {
      if (before.includes(id)) { problems.push(`${at}: adds ${id}, which a rule already found — write the rule, not the route`); continue; }
      next.push(id);
    }
    if (r.crit) {
      if (!next.includes(r.crit)) { problems.push(`${at}: makes ${r.crit} primary, but nothing puts it on this card — add it in the same entry, or write the rule`); continue; }
      if (next[0] === r.crit && !(r.add ?? []).includes(r.crit)) { problems.push(`${at}: ${r.crit} is already first — the entry changes nothing`); continue; }
      next = [r.crit, ...next.filter((x) => x !== r.crit)];
    }
    /* `topic` counts as doing something, but it is HARVEST's field, not this script's —
       harvest.mjs applies it and enforces its own contract on it (anchor still opens the
       question, declared topic actually differs from the rules'). Without it here, a
       topic-only entry fails as "does nothing" even though it is doing the one thing it
       was written to do. */
    if (!(r.crit || (r.add ?? []).length || (r.drop ?? []).length || r.topic)) { problems.push(`${at}: does nothing — needs at least one of crit/add/drop/topic`); continue; }
    for (const id of next) if (!(pack.criteria ?? []).some((cr) => cr.id === id)) problems.push(`${at}: ${id} is not a focus point this pack declares`);
    ruleHits.set(c, next);
  }
  if (problems.length) {
    console.error(`✗ ${problems.length} problem(s) in routes.json:\n   ` + problems.join('\n   '));
    process.exit(1);
  }
}

const mapped = [];
const unmapped = [];
for (const c of BOUND) {
  const hits = ruleHits.get(c);
  if (hits.length) mapped.push({ card: c, crits: hits });
  else unmapped.push(c);
}

/* ── --why: show the TEXT each rule fired on ─────────────────────────────────
   A criterion tag is a claim that the card teaches that focus point, and the counts
   alone cannot tell a real tag from a rule that hit a word in a distractor. This prints
   the matched substring beside every hit so a human can read the claim and judge it,
   which is what a review of `alsoCrit` actually requires. Read-only; writes nothing.
     node map-criteria.mjs --why           every card with more than 3 tags
     node map-criteria.mjs --why=resp-2    every card carrying that focus point */
const whyArg = process.argv.find((a) => a.startsWith('--why'));
if (whyArg) {
  const only = whyArg.includes('=') ? whyArg.split('=')[1] : null;
  const strip = (s) => String(s ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const rows = mapped.filter((m) => only ? m.crits.includes(only) : m.crits.length > 3);
  console.log(`\n══ WHY ${only ? `— cards carrying ${only}` : '— cards with more than 3 focus points'} (${rows.length}) ══\n`);
  for (const m of rows.sort((a, b) => b.crits.length - a.crits.length)) {
    const t = textOf(m.card);
    console.log(`${m.crits.length} tags · ${m.card.ev.quiz} · ${m.card.ev.n}`);
    console.log(`   ${strip(m.card.q).slice(0, 110)}`);
    for (const id of m.crits) {
      const rule = RULES.find(([x]) => x === id);
      const hit = rule && t.match(rule[1]);
      console.log(`     ${id.padEnd(9)} ${hit ? JSON.stringify(hit[0].slice(0, 70)) : '— declared in routes.json'}`);
    }
    console.log('');
  }
  process.exit(0);
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
