import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const required = ['index.html', 'manifest.webmanifest', 'favicon.svg', 'sw.js'];
for (const file of required) {
  if (!existsSync(join(dist, file))) throw new Error(`Missing deployment file: ${file}`);
}
const html = readFileSync(join(dist, 'index.html'), 'utf8');
const assetPaths = [...html.matchAll(/(?:src|href)="(\/assets\/[^"?#]+)"/g)].map((match) => match[1].slice(1));
if (!assetPaths.some((path) => path.endsWith('.js')) || !assetPaths.some((path) => path.endsWith('.css'))) {
  throw new Error('Built JavaScript or CSS reference missing from index.html');
}
for (const path of assetPaths) if (!existsSync(join(dist, path))) throw new Error(`Missing referenced asset: ${path}`);
// The legacy game loads these on demand. Missing chunks break portraits and races in production.
const chunks = readdirSync(join(dist, 'assets'));
for (const moduleName of ['track', 'kart', 'ai', 'input', 'items', 'effects', 'models', 'camera']) {
  if (!chunks.some((file) => file.startsWith(`${moduleName}-`) && file.endsWith('.js'))) {
    throw new Error(`Missing production game module: ${moduleName}`);
  }
}
const worker = readFileSync(join(dist, 'sw.js'), 'utf8');
if (!worker.includes('index.html') || !assetPaths.every((path) => worker.includes(path))) {
  throw new Error('Offline worker is missing a built asset');
}
console.log(`Deployment smoke check passed (${assetPaths.length} referenced assets).`);
