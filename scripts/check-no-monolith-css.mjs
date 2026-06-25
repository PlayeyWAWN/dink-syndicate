/**
 * Fail build if any CSS module exceeds the monolith line limit.
 * Checks css/shell/*.css and css/features/*.css (max 600 lines each).
 */
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const MAX_CSS_LINES = 600;

/** @param {string} dir */
function cssFilesIn(dir) {
  if (!statSync(dir, { throwIfNoEntry: false })?.isDirectory()) return [];
  return readdirSync(dir)
    .filter((name) => name.endsWith('.css'))
    .map((name) => join(dir, name));
}

const dirs = [
  join(root, 'css', 'shell'),
  join(root, 'css', 'features'),
];

const failures = [];

for (const dir of dirs) {
  for (const filePath of cssFilesIn(dir)) {
    const lines = readFileSync(filePath, 'utf8').split('\n').length;
    if (lines > MAX_CSS_LINES) {
      failures.push({ filePath, lines });
    }
  }
}

const monolith = join(root, 'css', 'layout-shell.css');
if (statSync(monolith, { throwIfNoEntry: false })?.isFile()) {
  failures.push({ filePath: monolith, lines: readFileSync(monolith, 'utf8').split('\n').length });
  console.error('check-no-monolith-css: css/layout-shell.css must be removed — use css/index.css barrel');
}

if (failures.length > 0) {
  for (const { filePath, lines } of failures) {
    const rel = filePath.replace(root + '\\', '').replace(root + '/', '');
    console.error(`check-no-monolith-css: FAILED — ${rel} has ${lines} lines (max ${MAX_CSS_LINES})`);
  }
  process.exit(1);
}

const checked = dirs.flatMap((dir) => cssFilesIn(dir)).length;
console.log(`check-no-monolith-css: OK (${checked} files, max ${MAX_CSS_LINES} lines each)`);
