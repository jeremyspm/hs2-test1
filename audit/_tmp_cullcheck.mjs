import { loadPack } from './load-pack.mjs';
const { pack } = loadPack();
console.log('coverage config:', JSON.stringify(pack.coverage));
const critsOf = c => [c.crit, ...(c.alsoCrit ?? [])].filter(Boolean);
const kept = pack.cards.filter(c => !c.bg);
console.log('cards now', pack.cards.length, '→ after cull', kept.length, '(dropping', pack.cards.length-kept.length, ')');
const per = {};
for (const c of kept) for (const id of critsOf(c)) per[id] = (per[id]||0)+1;
const { min: MIN = 6, blindMin: BLIND = 10 } = pack.coverage ?? {};
const fails = [];
for (const cr of pack.criteria) {
  const floor = cr.blind ? Math.max(MIN, BLIND) : MIN;
  const n = per[cr.id] || 0;
  if (n < floor) fails.push(`${cr.id}: ${n}/${floor}${cr.blind?' (BLIND)':''}`);
}
console.log('\ncriteria below floor after cull:', fails.length);
fails.forEach(f=>console.log('  ✗',f));
console.log('\nfull per-criterion count after cull:');
console.log(pack.criteria.map(cr=>`${cr.id}=${per[cr.id]||0}`).join(' '));
// type mix after
const t={}; for(const c of kept) t[c.type]=(t[c.type]||0)+1;
console.log('\ntypes after cull:', t);
const ti={}; for(const c of kept) ti[c.tier]=(ti[c.tier]||0)+1;
console.log('tiers after cull:', ti);
