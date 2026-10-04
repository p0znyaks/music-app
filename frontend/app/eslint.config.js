// @ts-check
const eslint = require('@eslint/js');
const tseslint = require('typescript-eslint');
const angular = require('angular-eslint');

module.exports = tseslint.config(
  {
    ignores: ['dist/**', 'coverage/**', 'node_modules/**', '.angular/**'],
  },
  {
    files: ['**/*.ts'],
    extends: [
      eslint.configs.recommended,
      ...tseslint.configs.recommended,
      ...tseslint.configs.stylistic,
      ...angular.configs.tsRecommended,
    ],
    processor: angular.processInlineTemplates,
    rules: {
      // tsconfig.json sets noUnusedLocals, so unused imports already fail the
      // build; this keeps the rule visible in the editor as well.
      '@angular-eslint/directive-selector': [
        'error',
        { type: 'attribute', prefix: 'app', style: 'camelCase' },
      ],
      '@angular-eslint/component-selector': [
        'error',
        { type: 'element', prefix: 'app', style: 'kebab-case' },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_' },
      ],
      // RxJS subscribe callbacks legitimately have nothing to do in one
      // branch (the error is surfaced elsewhere, next only resets a flag).
      // ESLint's rule schema does not accept a name-based allow-list, so this
      // is disabled rather than forcing noise-suppressing inline disables.
      '@typescript-eslint/no-empty-function': 'off',
      eqeqeq: ['error', 'smart'],
      'prefer-const': 'error',
    },
  },
  {
    files: ['**/*.html'],
    extends: [...angular.configs.templateRecommended, ...angular.configs.templateAccessibility],
    rules: {
      // The existing markup uses click handlers on non-interactive elements
      // (track rows, cards). Turning this into a hard error would block every
      // pull request on a codebase-wide markup change; it is tracked as a
      // warning so the count stays visible and can be driven to zero
      // deliberately, one component at a time.
      '@angular-eslint/template/click-events-have-key-events': 'warn',
      '@angular-eslint/template/interactive-supports-focus': 'warn',
      // `!= null` is the idiomatic nullish check in Angular templates: the
      // field is typed `number | null | undefined`, and the narrowing it
      // performs is what lets formatTime(q.duration) type-check.
      '@angular-eslint/template/eqeqeq': ['error', { allowNullOrUndefined: true }],
    },
  },
);