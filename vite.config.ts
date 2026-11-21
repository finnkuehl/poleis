import { defineConfig } from 'vitest/config';

export default defineConfig(({ command }) => ({
  // GitHub Pages serves the game under /poleis/ - only needed when building, locally "/" is enough
  base: command === 'build' ? '/poleis/' : '/',
  server: { port: 5173 },
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
}));
