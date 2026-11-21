import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

export default tseslint.config(
  { ignores: ['dist', 'node_modules'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.ts'],
    languageOptions: { globals: globals.browser },
  },
  {
    files: ['*.config.js', '*.config.ts'],
    languageOptions: { globals: globals.node },
  },
  // Architecture guard: core/ and ai/ are pure logic
  {
    files: ['src/core/**/*.ts', 'src/ai/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/render', '**/render/**', '**/ui', '**/ui/**', '**/save', '**/save/**'],
              message: 'core/ and ai/ must not import from render/, ui/ or save/.',
            },
          ],
          paths: [
            {
              name: 'pixi.js',
              message: 'core/ and ai/ must not use PixiJS (pure logic, no rendering).',
            },
          ],
        },
      ],
      'no-restricted-properties': [
        'error',
        {
          object: 'Math',
          property: 'random',
          message:
            'Only use the seeded RNG from the GameState - otherwise the game is not deterministic.',
        },
      ],
      'no-restricted-globals': [
        'error',
        { name: 'window', message: 'core/ and ai/ must not access the DOM.' },
        { name: 'document', message: 'core/ and ai/ must not access the DOM.' },
      ],
    },
  },
  prettier,
);
