import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['src/test/vitest.setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
