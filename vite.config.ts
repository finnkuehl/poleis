import { defineConfig } from 'vitest/config';

export default defineConfig(({ command }) => ({
  // GitHub Pages liegt unter /poleis/ – nur beim Bauen nötig, lokal reicht '/'
  base: command === 'build' ? '/poleis/' : '/',
  server: { port: 5173 },
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
}));
