/**
 * After `vite build`, copy assets Vite does not bundle into `dist/`.
 */
import { copyFileSync, existsSync, mkdirSync, cpSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const dist = join(root, 'dist');

if (!existsSync(dist)) {
  console.error('postbuild-copy: dist/ missing — run vite build first');
  process.exit(1);
}

/** @param {string} rel */
function copyRootFile(rel) {
  const src = join(root, rel);
  if (!existsSync(src)) {
    console.warn('postbuild-copy: skip (missing):', rel);
    return;
  }
  const dest = join(dist, rel);
  mkdirSync(dirname(dest), { recursive: true });
  copyFileSync(src, dest);
  console.log('postbuild-copy:', rel, '→ dist/', rel);
}

for (const f of ['sw.js', '_redirects', 'manifest.json', 'favicon.svg']) {
  copyRootFile(f);
}

const publicAssets = ['favicon-16.png', 'favicon-32.png', 'apple-touch-icon.png'];
for (const f of publicAssets) {
  const src = join(root, 'public', f);
  if (!existsSync(src)) {
    console.warn('postbuild-copy: skip (missing): public/', f);
    continue;
  }
  const dest = join(dist, f);
  copyFileSync(src, dest);
  console.log('postbuild-copy: public/', f, '→ dist/', f);
}

const publicImages = join(root, 'public', 'images');
if (existsSync(publicImages)) {
  cpSync(publicImages, join(dist, 'images'), { recursive: true });
  console.log('postbuild-copy: dir public/images → dist/images');
}

const cssDir = join(root, 'css');
if (existsSync(cssDir)) {
  cpSync(cssDir, join(dist, 'css'), { recursive: true });
  console.log('postbuild-copy: dir css → dist/css');
}

const logoSrc = join(root, 'Images', 'Dink Syndicate Logo.webp');
const logoDest = join(dist, 'images', 'logo.webp');
if (existsSync(logoSrc)) {
  mkdirSync(join(dist, 'images'), { recursive: true });
  copyFileSync(logoSrc, logoDest);
  console.log('postbuild-copy: logo.webp → dist/images/');
}

console.log('postbuild-copy: done');
