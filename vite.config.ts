import { defineConfig } from 'vite';
import { resolve } from 'path';

/**
 * Vite config for the Conclave observation UI (Dev D).
 *
 * The UI lives in `src/ui` and is a browser ES-module app. Vite serves it with
 * HMR in dev and bundles it to `dist/ui` for the demo. Path aliases mirror the
 * root tsconfig so UI code can import shared types via `@shared/*` etc.
 */
export default defineConfig({
  root: resolve(__dirname, 'src/ui'),
  resolve: {
    alias: {
      '@shared': resolve(__dirname, 'src/shared'),
      '@events': resolve(__dirname, 'src/events'),
      '@perception': resolve(__dirname, 'src/perception'),
    },
  },
  server: {
    port: 5173,
    strictPort: false,
  },
  build: {
    outDir: resolve(__dirname, 'dist/ui'),
    emptyOutDir: true,
  },
});
