// ESLint configuration for the JavaScript files of this repository.
//
// Run it through `npm run lint`, which also checks the Prettier formatting
// declared in `.prettierrc.json`.

import js from '@eslint/js';
import globals from 'globals';

export default [
  js.configs.recommended,
  {
    // Userscripts are classic scripts injected into a page by a userscript
    // manager. They all declare `@grant none`, so no GM_* global is available.
    files: ['userscripts/**/*.js'],
    languageOptions: {
      sourceType: 'script',
      globals: {
        ...globals.browser,
        // Firefox gives content scripts this helper to hand a function to the page.
        exportFunction: 'readonly',
      },
    },
  },
  {
    // The CI scripts and their tests are ES modules run by Node.js.
    files: ['.github/scripts/**/*.mjs'],
    languageOptions: {
      globals: globals.node,
    },
  },
];
