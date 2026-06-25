/**
 * Fail build if index.html contains an inline business-logic monolith.
 * Allows theme flash + compact version check only (max 80 lines total inline script).
 */
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const indexPath = join(root, 'index.html');
const MAX_INLINE_SCRIPT_LINES = 80;

const html = readFileSync(indexPath, 'utf8');
const scriptRegex = /<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/gi;
let match;
let totalLines = 0;
let scriptCount = 0;

while ((match = scriptRegex.exec(html)) !== null) {
  scriptCount += 1;
  const body = match[1] ?? '';
  const lines = body.split('\n').filter((line) => line.trim().length > 0).length;
  totalLines += lines;
}

if (scriptCount === 0) {
  console.error('check-no-monolith: no inline scripts found (expected theme + version check)');
  process.exit(1);
}

if (totalLines > MAX_INLINE_SCRIPT_LINES) {
  console.error(
    `check-no-monolith: FAILED — ${totalLines} non-empty inline script lines (max ${MAX_INLINE_SCRIPT_LINES})`
  );
  process.exit(1);
}

console.log(`check-no-monolith: OK (${scriptCount} inline scripts, ${totalLines} non-empty lines)`);
