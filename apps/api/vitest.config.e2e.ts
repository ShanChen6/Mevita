import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    env: {
      NODE_ENV: 'test',
      MEDIA_MOCK_DIR: process.env.MEDIA_MOCK_DIR ?? '.uploads-test',
      JWT_ACCESS_SECRET:
        process.env.JWT_ACCESS_SECRET ?? 'test-secret-for-e2e-only-0123456789abcdef',
      DATABASE_URL:
        process.env.DATABASE_URL ??
        'postgresql://mevita:mevita@localhost:5432/mevita?schema=public',
    },
  },
});
