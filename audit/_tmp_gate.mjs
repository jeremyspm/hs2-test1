import { loadPack } from './load-pack.mjs';
const { pack } = loadPack();
const critsOf = c => [c.crit, ...(c.alsoCrit ?? [])].filter(Boolean);
const kept = pack.cards.filter(c => !c.bg);
const cardsFor = id => kept.filter(c => critsOf(c).includes(id));
console.log('BLIND criteria after cull (need an SAQ under blindNeedsSaq):');
for (const cr of pack.criteria.filter(c=>c.blind)) {
  const cs = cardsFor(cr.id);
  console.log(`  ${cr.id.padEnd(9)} n=${String(cs.length).padStart(2)} saq=${cs.some(c=>c.type==='saq')?'YES':'no '} herQ=${cr.herQuestions} — ${cr.name}`);
}
console.log('\nZERO check:', pack.criteria.filter(cr=>!cardsFor(cr.id).length).map(c=>c.id).join(', ')||'none ✓');
console.log('\nherQuestions vs kept cards, for the 12 thin ones:');
for (const id of ['cvs-7','cvs-10','cvs-13','resp-1','resp-6','resp-8','resp-10','resp-12','resp-15','resp-16','lymph-3','lymph-4']) {
  const cr = pack.criteria.find(c=>c.id===id);
  console.log(`  ${id.padEnd(9)} kept=${String(cardsFor(id).length).padStart(2)} herQuestions=${String(cr.herQuestions).padStart(2)}  ${cr.name}`);
}
