import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // Load scenarios are kept out of the default run: they take minutes.
    // Use `npm run test:load` for those.
    include: ['test/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/main.ts', 'src/**/scripts/**', 'src/migrations/**'],
      thresholds: {
        lines: 15,
        functions: 15,
        branches: 47,
        statements: 15,
      },
    },
  },
});