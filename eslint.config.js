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
  // Architektur-Wächter: core/ und ai/ sind reine Logik
  {
    files: ['src/core/**/*.ts', 'src/ai/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/render', '**/render/**', '**/ui', '**/ui/**', '**/save', '**/save/**'],
              message: 'core/ und ai/ dürfen nicht aus render/, ui/ oder save/ importieren.',
            },
          ],
          paths: [
            {
              name: 'pixi.js',
              message: 'core/ und ai/ dürfen kein PixiJS benutzen (reine Logik, kein Rendering).',
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
            'Nur den Seed-RNG aus dem GameState benutzen – sonst ist das Spiel nicht deterministisch.',
        },
      ],
      'no-restricted-globals': [
        'error',
        { name: 'window', message: 'core/ und ai/ dürfen nicht auf das DOM zugreifen.' },
        { name: 'document', message: 'core/ und ai/ dürfen nicht auf das DOM zugreifen.' },
      ],
    },
  },
  prettier,
);
