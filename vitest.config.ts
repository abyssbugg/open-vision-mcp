import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./test/setup.ts'],
    // Exclude the baseline/ reference clone (Phase 0) and standard dirs.
    // baseline/ contains the upstream's stale test files which would
    // otherwise be picked up by vitest's default globbing.
    exclude: [
      'node_modules/**',
      'dist/**',
      'baseline/**',
    ],
    coverage: {
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        'test/',
        '**/*.test.ts',
        '**/*.config.ts',
        '**/*.d.ts',
      ],
      include: ['src/**/*.ts'],
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80,
        },
      },
    },
    testTimeout: 10000,
    hookTimeout: 10000,
  },
});