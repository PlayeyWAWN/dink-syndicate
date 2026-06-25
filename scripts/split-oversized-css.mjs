/**
 * Split CSS files that exceed the monolith line limit into logical chunks.
 */
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

/** @param {string} content @param {number} start 1-based @param {number} end 1-based inclusive */
function sliceLines(content, start, end) {
  const lines = content.split('\n');
  const endIdx = end >= 9999 ? lines.length : end;
  return lines.slice(start - 1, endIdx).join('\n').trimEnd() + '\n';
}

/** @param {string} file */
function read(file) {
  return readFileSync(join(root, file), 'utf8');
}

/** @param {string} file @param {string} content */
function write(file, content) {
  writeFileSync(join(root, file), content, 'utf8');
  console.log(`  ${file}: ${content.split('\n').length} lines`);
}

const layout = read('css/shell/layout.css');
const queue = read('css/features/queue.css');
const stats = read('css/features/stats.css');

write('css/shell/layout.css', sliceLines(layout, 1, 517));
write(
  'css/shell/layout-forms.css',
  `/**\n * App shell — shared form inputs.\n */\n\n${sliceLines(layout, 519, 677)}`
);
write(
  'css/shell/layout-settings.css',
  `/**\n * Settings panels — app info, data management.\n */\n\n${sliceLines(layout, 678, 9999)}`
);

write('css/features/queue.css', sliceLines(queue, 1, 435));
write(
  'css/features/queue-actions.css',
  `/**\n * Queue tab — excluded players, create match, mode toggles.\n */\n\n${sliceLines(queue, 436, 883)}`
);
write('css/features/queue-recent.css', sliceLines(queue, 884, 9999));

write('css/features/stats.css', sliceLines(stats, 1, 431));
write('css/features/stats-export.css', sliceLines(stats, 432, 684));
write('css/features/stats-arrival.css', sliceLines(stats, 685, 894));
write('css/features/stats-summary.css', sliceLines(stats, 895, 1080));
write('css/features/stats-analytics.css', sliceLines(stats, 1081, 9999));

write(
  'css/index.css',
  `/**
 * CSS barrel — import order matters (shell → features).
 */
@import './themes.css';
@import './components/app-icons.css';
@import './shell/layout.css';
@import './shell/layout-forms.css';
@import './shell/layout-settings.css';
@import './features/players.css';
@import './features/players-registration.css';
@import './features/queue.css';
@import './features/queue-actions.css';
@import './features/queue-recent.css';
@import './features/queue-dialog.css';
@import './features/match-board.css';
@import './features/courts.css';
@import './features/stats.css';
@import './features/stats-export.css';
@import './features/stats-arrival.css';
@import './features/stats-summary.css';
@import './features/stats-analytics.css';
`
);

console.log('split-oversized-css: done');
