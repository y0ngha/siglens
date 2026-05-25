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
        // Ratcheted to measured values. Branches remain below 90% because
        // the remaining ~200 uncovered branches live in canvas-based chart
        // widgets (lightweight-charts), complex analysis hooks (useChat,
        // useAnalysis, useOverallAnalysis), and options TSX components that
        // require E2E/visual testing. All pure logic and simpler UI layers
        // are above 90%.
        statements: 91,
        branches: 85,
        functions: 91,
        lines: 92,
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
