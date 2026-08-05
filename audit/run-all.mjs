/* Rebuild the whole evidence base and re-run every gate, in dependency order.
   Any failing gate exits non-zero — this is the command CI (or you) runs. */
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const steps = [
  ['python', ['extract-pdfs.py'], 'Phase 1a · PDF sidecar'],
  ['node', ['build-corpus.mjs'], 'Phase 1a · registry + corpus'],
  ['node', ['parse-quizzes.mjs'], 'Phase 1b · quiz question bank'],
  ['node', ['extract-formative.mjs'], 'Phase 1c · formative keys'],
  ['node', ['verify-quizzes.mjs'], 'Phase 1 GATE · verify question bank'],
  ['node', ['check-quantities.mjs'], 'Phase 2 · declared quantities vs corpus'],
  ['node', ['validate-selftest.mjs'], 'Phase 2 GATE · every gate is live'],
  ['node', ['harvest.mjs'], 'Phase 3 · harvest her questions'],
  ['node', ['verify-harvest.mjs'], 'Phase 3 GATE · cards are hers, unaltered'],
  ['python', ['optimise-images.py'], 'Phase 4 · image budget'],
  ['node', ['bind-images.mjs'], 'Phase 4 · bind figures to cards'],
  ['node', ['map-criteria.mjs'], 'Phase 4 · criteria map + blind list'],
  ['node', ['migrate.mjs'], 'Phase 4 · triage proposal for the 392'],
  ['node', ['ledger.mjs'], 'Phase 0 · card ledger'],
];
/* validate.mjs is run separately and is EXPECTED to fail until the pack is migrated —
   it is the worklist, not a gate on the evidence base. */
for (const [cmd, args, label] of steps) {
  process.stdout.write(`\n═══ ${label} ${'═'.repeat(Math.max(0, 46 - label.length))}\n`);
  try {
    execFileSync(cmd, args, { cwd: HERE, stdio: 'inherit' });
  } catch (e) {
    console.error(`\n✗ FAILED: ${label}`);
    process.exit(1);
  }
}
console.log('\n✓ evidence base rebuilt, all gates passed');
