import { defineConfig } from 'vitest/config';

/** Load-test runner: separate from the fast unit suite because it takes minutes. */
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['test/**/*.load.ts'],
    testTimeout: 600_000,
    hookTimeout: 600_000,
  },
});