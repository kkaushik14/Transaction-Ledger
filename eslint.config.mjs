/**
 * Workspace lint rules for Node ESM, browser React, and shared TypeScript.
 * Prettier owns formatting; globals stay scoped to their runtime boundaries.
 */
import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default [
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/coverage/**',
      '**/.vite/**',
      '.pnpm-store/**',
      'planning/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['apps/**/*.{ts,tsx}', 'packages/**/*.ts'],
    rules: {
      // Cross-folder code imports use the owning folder's explicit public entry.
      // Sibling implementation imports and non-code assets do not go through barrels.
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex:
                '^(?:\\.\\./|\\./[^/]+/)(?!(?:.*/)?index(?:\\.[cm]?[jt]sx?)?$)(?!.*\\.(?:css|svg|png|jpe?g|webp|woff2?|json)$)',
              message: 'Import code across folders through the owning index.js (index.ts source).',
            },
            {
              group: ['@ledger/contracts/*'],
              message: 'Use the public @ledger/contracts package entry.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['**/*.mjs', 'apps/api/**/*.ts', 'apps/web/*.config.ts'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['apps/web/src/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['error', { allowConstantExport: true }],
    },
  },
  {
    files: ['apps/web/tests/**/*.{ts,tsx}', 'apps/web/e2e/**/*.ts'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
  prettier,
];
