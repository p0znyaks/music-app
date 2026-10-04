// @ts-check
const eslint = require('@eslint/js');
const tseslint = require('typescript-eslint');

module.exports = tseslint.config(
  {
    ignores: ['dist/**', 'coverage/**', 'node_modules/**', 'vitest*.ts'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.ts', 'test/**/*.ts'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        console: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        URL: 'readonly',
      },
    },
    rules: {
      // Unused code: tsc already catches unused locals/parameters at build
      // time, this additionally catches unused *exports* (helpers that no
      // longer have any callers), which is the part tsc cannot see.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // Empty catch blocks silently swallow failures; we log instead.
      'no-empty': ['error', { allowEmptyCatch: false }],
      eqeqeq: ['error', 'smart'],
      'prefer-const': 'error',
      'no-var': 'error',
    },
  },
  {
    // Tests build partial Express request/response objects and assert on them,
    // where `any` keeps the mocks readable. The production code stays typed.
    files: ['test/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  {
    // `declare global` is how Express augments Request with `user`; that is a
    // declaration merge and therefore necessarily a namespace.
    files: ['src/middleware/**/*.ts'],
    rules: {
      '@typescript-eslint/no-namespace': 'off',
    },
  },
);