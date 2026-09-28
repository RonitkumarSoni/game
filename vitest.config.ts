import { defineConfig } from 'vitest/config';

const fromRoot = (path: string) => new URL(path, import.meta.url).pathname;

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
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
