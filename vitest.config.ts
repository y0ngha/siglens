import { configDefaults, defineConfig } from 'vitest/config';
import path from 'node:path';

const sharedConfig = {
    resolve: {
        alias: {
            '@': path.resolve(__dirname, 'src'),
            // Mirrors tsconfig's "@e2e/*" alias so src files that consume E2E
            // fixtures (e.g. FakeMarketProvider importing e2e/fixtures/bars.json)
            // resolve identically under Vitest, tsc, and the Next build.
            '@e2e': path.resolve(__dirname, 'e2e'),
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
    // `vmThreads`는 워커 한 개 안에서 여러 테스트 파일이 process.env를 공유한다.
    // `vi.stubEnv`가 파일의 마지막 테스트 뒤 자동 복원되지 않으면(기본 unstubEnvs=false)
    // 스텁된 env가 같은 워커의 다음 파일로 새어, isE2E()를 켜 factory들의
    // `require('./Fake*')` dead-branch를 활성화 → "Cannot find module" flake를 일으킨다.
    // 매 테스트 후 자동 unstub해 누수를 차단한다(전역 afterEach의 raw E2E_TEST 복원과 함께).
    unstubEnvs: true as const,
    // Keep Vitest and Playwright runners disjoint. The Playwright suite lives in
    // `e2e/**` (`.spec.ts`), so it already falls outside our `src/**` include
    // patterns — but excluding it explicitly is belt-and-suspenders against any
    // future include widening, and documents the boundary. Spread Vitest's own
    // defaults so node_modules / dist / etc. stay excluded.
    exclude: [...configDefaults.exclude, 'e2e/**'],
};

/**
 * Coverage OOM 해결책 (widgets 레이어 v8 계측 힙 고갈):
 * Vitest 4는 vmThreads poolOptions.execArgv를 제거해 vitest.config.ts 내부에서
 * 워커 힙 크기를 직접 설정할 수 없다(ERR_WORKER_INVALID_EXEC_ARGV).
 * 대신 `package.json`의 test-coverage 스크립트에서
 *   `NODE_OPTIONS="--no-experimental-webstorage --max-old-space-size=4096"`
 * 를 설정해 Vitest 프로세스 자체의 힙을 확보한다. vmThreads 워커는 부모의
 * --max-old-space-size를 상속하므로 워커별 OOM도 함께 해소된다.
 */
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
                        // Build-tooling tests (skill validation gate) live under
                        // scripts/ — scripts/ is tsconfig-excluded but its unit
                        // tests still run here so CI's `yarn test` covers them.
                        'scripts/**/__tests__/**/*.test.ts',
                        // ISR cache handler lives outside src/ as plain ESM (.mjs)
                        // so Next.js can require() it without any transpilation step.
                        'cache-handler/**/__tests__/**/*.test.mjs',
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
