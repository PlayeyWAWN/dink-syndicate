/**
 * Split css/layout-shell.css into modular files (Phase 1).
 */
import { readFileSync, writeFileSync, mkdirSync, unlinkSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const lines = readFileSync(join(root, 'css', 'layout-shell.css'), 'utf8').split('\n');

/** @param {number} start 1-based inclusive @param {number} end 1-based inclusive */
function slice(start, end) {
  return lines.slice(start - 1, end).join('\n').trim();
}

function joinBlocks(...blocks) {
  return blocks.filter(Boolean).join('\n\n') + '\n';
}

const shellLayout = joinBlocks(
  '/**\n * App shell — layout, navigation, shared components, forms.\n */',
  slice(1, 483),
  `/* Shared input styling */
.settings-input {
  padding: 0.55rem 0.75rem;
  border-radius: 8px;
  border: 1px solid var(--input-border);
  background: var(--input-bg);
  color: var(--input-text);
  font-family: inherit;
}`,
  slice(853, 860),
  slice(2220, 2246)
);

const playersCss = joinBlocks(
  '/**\n * Players tab — roster, filters, registration.\n */',
  `/* Player form + registration inputs */
.player-form input,
.player-card__rating {
  padding: 0.55rem 0.75rem;
  border-radius: 8px;
  border: 1px solid var(--input-border);
  background: var(--input-bg);
  color: var(--input-text);
  font-family: inherit;
}`,
  slice(485, 604),
  slice(617, 621),
  slice(623, 1025),
  slice(1027, 1166)
);

const queueCss = joinBlocks(
  '/**\n * Queue tab — waiting queue, mode toggles, available players panel.\n */',
  slice(1168, 1170),
  slice(1213, 1297),
  slice(1373, 1578),
  slice(1660, 1760),
  slice(1762, 1964)
);

const matchBoardCss = joinBlocks(
  '/**\n * Active matches — court board, player chips, live match cards.\n */',
  slice(1299, 1371),
  slice(1966, 2133)
);

const courtsCss = joinBlocks(
  '/**\n * Courts tab — court cards and add-court modal.\n */',
  slice(1587, 1658),
  slice(2141, 2203)
);

const statsCss = joinBlocks(
  '/**\n * Stats tab — rankings table and export targets.\n */',
  slice(2205, 2218)
);

const indexCss = `/**
 * CSS barrel — import order matters (shell → features).
 */
@import './themes.css';
@import './shell/layout.css';
@import './features/players.css';
@import './features/queue.css';
@import './features/match-board.css';
@import './features/courts.css';
@import './features/stats.css';
`;

for (const d of [join(root, 'css', 'shell'), join(root, 'css', 'features')]) {
  mkdirSync(d, { recursive: true });
}

writeFileSync(join(root, 'css', 'shell', 'layout.css'), shellLayout);
writeFileSync(join(root, 'css', 'features', 'players.css'), playersCss);
writeFileSync(join(root, 'css', 'features', 'queue.css'), queueCss);
writeFileSync(join(root, 'css', 'features', 'match-board.css'), matchBoardCss);
writeFileSync(join(root, 'css', 'features', 'courts.css'), courtsCss);
writeFileSync(join(root, 'css', 'features', 'stats.css'), statsCss);
writeFileSync(join(root, 'css', 'index.css'), indexCss);

const monolith = join(root, 'css', 'layout-shell.css');
if (existsSync(monolith)) {
  unlinkSync(monolith);
  console.log('split-layout-css: removed css/layout-shell.css');
}

for (const rel of [
  'css/shell/layout.css',
  'css/features/players.css',
  'css/features/queue.css',
  'css/features/match-board.css',
  'css/features/courts.css',
  'css/features/stats.css',
]) {
  const count = readFileSync(join(root, rel), 'utf8').split('\n').length;
  console.log(`  ${rel}: ${count} lines`);
}

console.log('split-layout-css: done');
