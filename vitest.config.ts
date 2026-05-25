import { defineConfig } from 'vitest/config';
import path from 'node:path';

const sharedConfig = {
    resolve: {
        alias: {
            '@': path.resolve(__dirname, 'src'),
        },
    },
};

const sharedTestConfig = {
    globals: true as const,
    setupFiles: ['./vitest.setup.ts'],
};

const coverageConfig = {
    provider: 'v8' as const,
    include: [
        'src/entities/**/*.{ts,tsx}',
        'src/features/**/*.{ts,tsx}',
        'src/shared/**/*.{ts,tsx}',
        'src/widgets/**/*.{ts,tsx}',
        'src/app/**/*.{ts,tsx}',
        'src/proxy.ts',
    ],
    exclude: [
        '**/*.d.ts',
        '**/index.ts',
        '**/types.ts',
        '**/model.ts',
        '**/test-utils/**',
        'src/entities/*/actions.ts',
        'src/entities/*/actions/index.ts',
        'src/features/*/actions.ts',
    ],
    thresholds: {
        // Temporarily lowered from 90% because coverage scope was expanded to include
        // widgets/, app/, features/hooks/, features/ui/, shared/hooks/, shared/ui/ layers.
        // These new layers currently have <50% coverage.
        // Ramp-up plan: 50% → 60% (Phase 1+2) → 70% (Phase 3) → 80% (Phase 4) → 90% (Phase 6+7)
        // See docs/superpowers/plans/2026-05-25-test-coverage-full-layers.md §Threshold Ramp-Up
        // Previously tested layers (entities, features/lib, shared/lib) maintain 90%+ individually.
        statements: 50,
        branches: 50,
        functions: 50,
        lines: 50,
    },
};

export default defineConfig({
    ...sharedConfig,
    test: {
        ...sharedTestConfig,
        coverage: coverageConfig,
        projects: [
            {
                ...sharedConfig,
                test: {
                    ...sharedTestConfig,
                    name: 'node',
                    include: ['src/**/__tests__/**/*.test.ts'],
                    environment: 'node',
                },
            },
            {
                ...sharedConfig,
                test: {
                    ...sharedTestConfig,
                    name: 'jsdom',
                    include: ['src/**/__tests__/**/*.test.tsx'],
                    environment: 'jsdom',
                    environmentOptions: {
                        jsdom: {
                            url: 'http://localhost:4200',
                        },
                    },
                },
            },
        ],
    },
});
