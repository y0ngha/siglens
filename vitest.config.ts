import { configDefaults, defineConfig } from 'vitest/config';
import path from 'node:path';

const sharedConfig = {
    resolve: {
        alias: {
            '@': path.resolve(__dirname, 'src'),
            // server-only는 Next.js 전용 guard 패키지로 실제 설치 불필요.
            // Vitest 환경에서는 빈 stub으로 resolve해 transform 오류를 방지한다.
            'server-only': path.resolve(
                __dirname,
                'src/__tests__/server-only-stub.ts'
            ),
        },
    },
};

const sharedTestConfig = {
    globals: true as const,
    pool: 'vmThreads' as const,
    maxThreads: 8,
    experimental: { fsModuleCache: true },
    // Keep Vitest and Playwright runners disjoint. The Playwright suite lives in
    // `e2e/**` (`.spec.ts`), so it already falls outside our `src/**` include
    // patterns — but excluding it explicitly is belt-and-suspenders against any
    // future include widening, and documents the boundary. Spread Vitest's own
    // defaults so node_modules / dist / etc. stay excluded.
    exclude: [...configDefaults.exclude, 'e2e/**'],
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
