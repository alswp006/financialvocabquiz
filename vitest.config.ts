import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    // Playwright 비주얼 스펙은 e2e/에 있다 — vitest 실행에서 제외(기본 제외 + e2e).
    // scripts/__tests__는 node:test 러너용(node --test)이라 vitest 실행에서 제외.
    exclude: ['**/node_modules/**', '**/dist/**', 'e2e/**', 'scripts/**'],
  },
});
