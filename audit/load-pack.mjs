// Load pack.js exactly as the build does, with figure helpers stubbed,
// so the ledger reflects real objects rather than a regex approximation.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');

export function loadPack(packPath) {
  const src = fs.readFileSync(packPath ?? path.join(ROOT, 'pack.js'), 'utf8');
  const figCalls = [];
  const ctx = vm.createContext({
    F:  (id) => { figCalls.push(['F', id]);  return `@@FIG:${id}`; },
    FC: (id) => { figCalls.push(['FC', id]); return `@@FIGCAP:${id}`; },
  });
  vm.runInContext(src + '\n;globalThis.__PACK__ = PACK;', ctx, { filename: 'pack.js' });
  return { pack: ctx.__PACK__, figCalls, src };
}
