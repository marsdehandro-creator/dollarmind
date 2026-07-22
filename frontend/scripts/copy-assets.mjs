/**
 * Copies runtime binary assets that libraries fetch by URL at runtime rather
 * than importing as modules — Vite doesn't bundle these automatically, so
 * they must land in public/ before dev/build. Cross-platform (no shell cp),
 * run via the predev/prebuild npm scripts.
 *
 *  - sql.js: the on-device web SQLite engine (webSqlJsDriver.ts) fetches its
 *    wasm binary from /assets/*.wasm.
 *  - tesseract.js: on-device OCR (ocrProvider.ts) fetches its worker script,
 *    wasm core, and English trained-data file the same way — bundled here so
 *    OCR works fully offline instead of hitting a CDN.
 */
import { copyFileSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const nodeModules = join(__dirname, '..', '..', 'node_modules');
const publicDir = join(__dirname, '..', 'public', 'assets');

function copy(srcDir, name, destSubdir = '') {
  const src = join(srcDir, name);
  if (!existsSync(src)) {
    console.error(`copy-assets: source not found at ${src} — is the package installed?`);
    process.exit(1);
  }
  const destDir = join(publicDir, destSubdir);
  mkdirSync(destDir, { recursive: true });
  const dest = join(destDir, name);
  copyFileSync(src, dest);
  console.log(`copy-assets: copied ${name} -> ${dest}`);
}

// sql.js: Vite resolves the "browser" package-export condition
// (sql-wasm-browser.js), whose internal locateFile() asks for
// sql-wasm-browser.wasm specifically — not the plain sql-wasm.wasm. Copy both
// so either resolution path finds its file.
const sqlJsDir = join(nodeModules, 'sql.js', 'dist');
copy(sqlJsDir, 'sql-wasm.wasm');
copy(sqlJsDir, 'sql-wasm-browser.wasm');

// tesseract.js: worker script + wasm core (simd-lstm variant: best accuracy/speed
// on modern browsers) + English trained data, all served locally so recognize()
// never needs the internet.
copy(join(nodeModules, 'tesseract.js', 'dist'), 'worker.min.js', 'tesseract');
copy(join(nodeModules, 'tesseract.js-core'), 'tesseract-core-simd-lstm.wasm.js', 'tesseract');
copy(join(nodeModules, 'tesseract.js-core'), 'tesseract-core-simd-lstm.wasm', 'tesseract');
copy(join(nodeModules, '@tesseract.js-data', 'eng', '4.0.0'), 'eng.traineddata.gz', 'tesseract');
