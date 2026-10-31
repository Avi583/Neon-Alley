import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['docs/**', 'dist/**'] },
  js.configs.recommended,
  {
    files: ['src/**/*.js'],
    languageOptions: { ecmaVersion: 'latest', sourceType: 'module', globals: globals.browser },
    rules: { 'no-unused-vars': ['warn', { args: 'none', caughtErrors: 'none' }] },
  },
  {
    files: ['tests/**/*.js'],
    languageOptions: { ecmaVersion: 'latest', sourceType: 'module', globals: globals.browser },
  },
  {
    files: ['vite.config.js', 'eslint.config.js', 'playwright.config.js'],
    languageOptions: { globals: globals.node },
  },
];
