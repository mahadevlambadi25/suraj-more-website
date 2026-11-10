import path from 'node:path';
import { defineConfig } from 'vitest/config';

const TEST_DB = process.env.TEST_DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5433/suraj_test';

export default defineConfig({
  // Compile JSX like Next.js does (React 17+ automatic runtime) so server components can be rendered in tests.
  esbuild: { jsx: 'automatic' },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      // `server-only` throws outside the React server bundle; tests run server code directly.
      'server-only': path.resolve(__dirname, 'tests/stubs/server-only.ts'),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    globalSetup: ['./tests/global-setup.ts'],
    setupFiles: ['./tests/setup.ts'],
    // One shared database → run files sequentially.
    fileParallelism: false,
    pool: 'forks',
    testTimeout: 30_000,
    hookTimeout: 120_000,
    env: {
      DATABASE_URL: TEST_DB,
      DIRECT_URL: TEST_DB,
      CASHFREE_MODE: 'mock',
      NEXT_PUBLIC_SITE_URL: 'https://test.example',
      HASH_SALT: 'test-salt',
    },
  },
});
