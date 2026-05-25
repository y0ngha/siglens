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
        // Phase 8 (final): ratcheted to actual measured coverage.
        // Branches are the bottleneck at ~78% — widget hooks and options UI
        // have many untested conditional branches. Remaining gap to 90%:
        //   statements +3.6%, branches +11.3%, functions +4.7%, lines +2.7%
        statements: 86,
        branches: 78,
        functions: 85,
        lines: 87,
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
                    include: [
                        'src/**/__tests__/**/*.test.ts',
                        'src/__integration__/**/*.test.ts',
                    ],
                    environment: 'node',
                },
            },
            {
                ...sharedConfig,
                test: {
                    ...sharedTestConfig,
                    name: 'jsdom',
                    include: [
                        'src/**/__tests__/**/*.test.tsx',
                        'src/__integration__/**/*.test.tsx',
                    ],
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
