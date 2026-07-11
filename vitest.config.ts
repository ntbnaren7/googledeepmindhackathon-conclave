import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

/**
 * Vitest config (Dev D). Declares the tsconfig path aliases manually (rather
 * than via the ESM-only vite-tsconfig-paths plugin, which can't be required in
 * this CommonJS project) so source files importing `@shared/*`, `@perception/*`,
 * etc. resolve at test runtime.
 */
const alias = (name: string) => ({
  find: new RegExp(`^@${name}/`),
  replacement: `${resolve(__dirname, 'src', name)}/`,
});

export default defineConfig({
  resolve: {
    alias: [
      alias('shared'),
      alias('events'),
      alias('context'),
      alias('knowledge'),
      alias('perception'),
      alias('kernel'),
      alias('agents'),
      alias('output'),
    ],
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
