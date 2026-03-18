import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['apps/server/src/roomLifecycle.smoke.test.ts'],
  },
});
