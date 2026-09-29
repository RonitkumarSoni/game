import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

const fromRoot = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.{ts,js}'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.d.ts'],
    },
  },
  resolve: {
    alias: {
      '@': fromRoot('./src'),
      '@core': fromRoot('./src/core'),
      '@game': fromRoot('./src/game'),
      '@ui': fromRoot('./src/ui'),
      '@data': fromRoot('./src/data'),
    },
  },
});
