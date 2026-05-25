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
    pool: 'vmThreads' as const,
    poolOptions: {
        vmThreads: {
            maxThreads: 8,
        },
    },
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
        // Next.js async server components (page.tsx, layout.tsx, loading.tsx, error.tsx,
        // opengraph-image.tsx, twitter-image.tsx) are excluded because they return
        // Promise<JSX.Element> which @testing-library/react cannot render.
        // Official recommendation: use E2E tests. See https://nextjs.org/docs/app/guides/testing
        // Their composed logic is tested via entities, features, and widgets layers.
        'src/app/**/page.tsx',
        'src/app/**/loading.tsx',
        'src/app/**/error.tsx',
        'src/app/**/layout.tsx',
        'src/app/**/opengraph-image.tsx',
        'src/app/**/twitter-image.tsx',
        // App-level RSC data loaders use React cache() + server-only DB/API calls.
        // Same rationale as page.tsx: tested via the entities/shared layers they compose.
        'src/app/**/*Data.ts',
    ],
    thresholds: {
        statements: 90,
        branches: 90,
        functions: 90,
        lines: 90,
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
                    setupFiles: ['./vitest.setup.node.ts'],
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
                    name: 'dom',
                    setupFiles: ['./vitest.setup.dom.ts'],
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
