import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));

/**
 * Vitest config for Sora-MissionControl.
 * Mirrors the `@/` → `src/` alias from vite.config.ts and tsconfig.json so
 * test imports resolve identically to the app build.
 *
 * The test environment is `node` (not jsdom) because the chat store is pure
 * state logic with no DOM dependencies. React's `useSyncExternalStore` is
 * imported by the store but only exercised via the `useChatState` hook,
 * which the tests do not call — they call the store mutators/selectors
 * directly. `useSyncExternalStore` still imports cleanly under node.
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(here, 'src'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    globals: false,
  },
});