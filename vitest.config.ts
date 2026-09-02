import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

// No @vitejs/plugin-react on purpose: vitest transforms .tsx with esbuild using
// `jsx: "react-jsx"` from tsconfig.json, and React Fast Refresh has no meaning
// inside a test run. The plugin only added a peer-dependency conflict.
export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
  resolve: {
    alias: {
      // Mirrors the `@/*` path from tsconfig.json.
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});
