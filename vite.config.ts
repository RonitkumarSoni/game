import { defineConfig } from 'vite';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const fromRoot = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  plugins: [{
    name: 'offline-game-assets',
    generateBundle(_options, bundle) {
      const files = Object.keys(bundle).filter((file) => !file.endsWith('.map'));
      const precache = ['index.html', 'favicon.svg', 'manifest.webmanifest', ...files.filter((file) => file !== 'index.html')];
      const digest = createHash('sha256');
      for (const file of files) {
        const asset = bundle[file];
        digest.update(file).update(asset.type === 'chunk' ? asset.code : asset.source);
      }
      digest.update(readFileSync(new URL('./public/manifest.webmanifest', import.meta.url)));
      const version = digest.digest('hex').slice(0, 12);
      const template = readFileSync(new URL('./scripts/sw-template.js', import.meta.url), 'utf8');
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: template.replace('__CACHE_NAME__', `nrr-${version}`).replace('__PRECACHE__', JSON.stringify(precache)) });
    },
  }],
  root: '.',
  publicDir: 'public',
  resolve: {
    alias: {
      '@': fromRoot('./src'),
      '@core': fromRoot('./src/core'),
      '@game': fromRoot('./src/game'),
      '@ui': fromRoot('./src/ui'),
      '@data': fromRoot('./src/data'),
    },
  },
  server: {
    port: 3000,
    open: true,
  },
  build: {
    target: 'es2022',
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
        },
      },
    },
  },
  // Allow importing legacy JS files during migration
  optimizeDeps: {
    noDiscovery: true,
    exclude: ['three', 'gsap'],
  },
});
