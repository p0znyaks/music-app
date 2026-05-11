import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['test/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/main.ts', 'src/**/scripts/**'],
      thresholds: {
        lines: 15,
        functions: 15,
        branches: 47,
        statements: 15,
      },
    },
  },
});