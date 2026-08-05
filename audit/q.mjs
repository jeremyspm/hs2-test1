/* Corpus query — the tool used to write quantities.json by hand.
     node audit/q.mjs "104\s*mm"            regex over the corpus
     node audit/q.mjs "dead space" --all    show every hit, not the first 8
     node audit/q.mjs --at SRC-2026-RESP2 "slide 4"   dump a specific location  */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const corpus = JSON.parse(fs.readFileSync(path.join(HERE, 'corpus.json'), 'utf8'));
const registry = JSON.parse(fs.readFileSync(path.join(HERE, 'registry.json'), 'utf8'));

const args = process.argv.slice(2);
const all = args.includes('--all');
const atIdx = args.indexOf('--at');

if (atIdx !== -1) {
  const src = args[atIdx + 1];
  const loc = args[atIdx + 2];
  for (const u of corpus) {
    if (u.src === src && (!loc || u.loc === loc)) {
      console.log(`[${u.src} ${u.loc}]${u.bold ? ' bold=' + JSON.stringify(u.bold) : ''}`);
      console.log('   ' + u.t + '\n');
    }
  }
  process.exit(0);
}

const pat = new RegExp(args.filter(a => !a.startsWith('--'))[0], 'i');
const hits = corpus.filter(u => pat.test(u.t));
const shown = all ? hits : hits.slice(0, 8);
for (const u of shown) {
  const auth = registry[u.src]?.authority ?? '?';
  console.log(`[${registry[u.src]?.label?.slice(0, 44) ?? u.src} · ${u.loc} · ${auth}]`);
  const m = u.t.match(pat);
  const i = Math.max(0, u.t.indexOf(m[0]) - 130);
  console.log('   …' + u.t.slice(i, i + 320) + '…\n');
}
console.log(`${hits.length} hit(s)${hits.length > shown.length ? ` (showing ${shown.length}; --all for the rest)` : ''}`);
