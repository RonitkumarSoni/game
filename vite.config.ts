import { defineConfig } from 'vite';

const fromRoot = (path: string) => new URL(path, import.meta.url).pathname;

export default defineConfig({
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
    include: ['three'],
  },
});
