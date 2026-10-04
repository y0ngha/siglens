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
            // Vitest는 Next의 `react-server` export condition을 적용하지 않아
            // `next-intl/server`가 "Client Components에서 지원되지 않는다"고 던지는
            // stub으로 해석된다. 서버 컴포넌트를 직접 호출하는 이 레포의 페이지
            // 테스트가 통째로 깨지므로 실제 react-server 빌드로 직접 가리킨다
            // (mock이 아니라 실물이라 `setRequestLocale`의 실제 동작을 검증한다).
            // `next-intl/config`는 빌드 플러그인이 만드는 가상 모듈이라 vitest에는
            // 없다. 없으면 서버 컴포넌트의 번역 호출이 전부 "config file 없음"으로
            // 던진다. 실제 ko 카탈로그를 돌려주는 테스트 설정으로 대체한다.
            'next-intl/config': path.resolve(
                __dirname,
                'src/shared/test-utils/nextIntlTestConfig.ts'
            ),
            'next-intl/server': path.resolve(
                __dirname,
                'node_modules/next-intl/dist/esm/development/server.react-server.js'
            ),
            'server-only': path.resolve(
                __dirname,
                'src/__tests__/server-only-stub.ts'
            ),
        },
    },
};

const sharedTestConfig = {
    globals: true as const,
    // vitest 5에서 기본값이 true로 바뀌었다(매 테스트 전 `vi.clearAllMocks()`). 그러면
    // **모듈 로드 시점**의 호출 기록(예: `React.cache(fn)`로 감싸는 래퍼)이 첫 테스트 전에
    // 지워지고, "import 시점에 X를 부르지 않는다"류 단언은 조용히 공허해진다. 13k 테스트가
    // 전제로 삼아 온 vitest 4 의미를 유지한다 — 격리가 필요한 테스트는 지금처럼 직접 clear한다.
    clearMocks: false,
    // forks(child_process) 풀을 쓴다. 도입 당시 Node 25 + jsdom에서는 worker_threads
    // 기반 풀(vmThreads·threads)의 워커가 기동 즉시 크래시했다("Worker exited
    // unexpectedly"). `.nvmrc`를 24로 내린 뒤(2026-09-24) Node 24.21에서는 worker 풀도
    // 기동은 되지만, 프로세스 격리가 확실한 forks를 유지한다 — vmThreads는 파일 사이
    // env 누수로 CI 간헐 실패를 낸 이력이 있다(PR #558). 시작 오버헤드는 감수한다.
    pool: 'forks' as const,
    maxWorkers: 8,
    // vitest 5에서 `experimental.fsModuleCache`가 정식 top-level 옵션으로 옮겨졌다. 옛 위치에
    // 두면 타입 에러이고 런타임에도 조용히 무시된다.
    fsModuleCache: true,
    // forks 풀도 워커(자식 프로세스) 하나가 여러 테스트 파일을 순차 재사용하므로
    // 한 파일에서 `vi.stubEnv`한 값이 자동 복원되지 않으면(기본 unstubEnvs=false)
    // 같은 워커의 다음 파일로 새어, isE2E()를 켜 factory들의
    // `require('./Fake*')` dead-branch를 활성화 → "Cannot find module" flake를 일으킨다.
    // 매 테스트 후 자동 unstub해 누수를 차단한다(전역 afterEach의 raw E2E_TEST 복원과 함께).
    unstubEnvs: true as const,
    // next-intl은 ESM 소스를 그대로 배포하고 그 안에서 `next/server`를 bare
    // specifier로 import한다. 외부 의존으로 두면 Vitest가 이를 파일 경로로 착각해
    // `node_modules/node_modules/next/server`를 찾다 실패한다. inline 처리하면
    // Vite의 resolver를 타서 정상 해석된다.
    server: { deps: { inline: [/next-intl/] } },
    // Keep Vitest and Playwright runners disjoint. The Playwright suite lives in
    // `e2e/**` (`.spec.ts`), so it already falls outside our `src/**` include
    // patterns — but excluding it explicitly is belt-and-suspenders against any
    // future include widening, and documents the boundary. Spread Vitest's own
    // defaults so node_modules / dist / etc. stay excluded.
    exclude: [...configDefaults.exclude, 'e2e/**'],
};

/**
 * Coverage OOM 해결책 (widgets 레이어 v8 계측 힙 고갈):
 * vitest.config.ts 내부에서는 워커 힙 크기를 직접 설정할 수 없어
 * `package.json`의 test-coverage 스크립트에서
 *   `NODE_OPTIONS="--no-experimental-webstorage --max-old-space-size=4096"`
 * 를 설정해 Vitest 프로세스 자체의 힙을 확보한다. forks 풀의 자식 프로세스는
 * 부모의 NODE_OPTIONS(--max-old-space-size 포함)를 상속하므로 워커별 OOM도
 * 함께 해소된다.
 */
const coverageConfig = {
    provider: 'v8' as const,
    // 실패한 실행에서도 리포트를 낸다. 기본값(false)이면 테스트가 하나라도 깨질 때
    // **커버리지 표가 아예 안 나온다** — 커버리지를 재려던 사람은 빈 출력을 보고
    // "측정이 안 됐다"고 오진한다(2026-08 감사에서 실제로 한 번 속았다).
    reportOnFailure: true,
    include: [
        'src/entities/**/*.{ts,tsx}',
        'src/features/**/*.{ts,tsx}',
        'src/shared/**/*.{ts,tsx}',
        'src/widgets/**/*.{ts,tsx}',
        // FSD pages 레이어(src/pages/는 Pages Router를 켜므로 views/로 둔다).
        // 페이지 조합 + 훅·유틸이 실제 로직을 갖는 레이어인데 include에서
        // 빠져 있어 90% 임계값이 적용되지 않았다.
        'src/views/**/*.{ts,tsx}',
        'src/app/**/*.{ts,tsx}',
        'src/proxy.ts',
        // ISR 캐시 핸들러는 src/ 밖의 평문 ESM이지만 프로덕션 코드다. include에 없으면
        // 90% 임계값이 적용되지 않아 커버리지가 조용히 썩는다.
        'cache-handler/**/*.mjs',
        // instrumentation.node.ts는 src/ 루트에 위치하며 0% 커버리지가 게이트에서 보이지
        // 않았다 — 여기 추가해야 90% 임계값이 이 파일에도 적용된다.
        'src/instrumentation*.ts',
    ],
    exclude: [
        '**/*.d.ts',
        '**/types.ts',
        '**/model.ts',
        '**/test-utils/**',
        // E2E 전용 결정적 Fake 구현체(E2E_TEST=1에서만 gated require로 로드).
        // 실제 제품 코드가 아니고 Playwright E2E가 직접 소비하므로 단위 커버리지
        // 게이트에서 제외한다 — 커버리지 수치는 제품 코드만 반영해야 한다.
        'src/**/Fake*.ts',
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

const DOM_TEST_PATTERNS = [
    'src/**/__tests__/**/*.test.tsx',
    'src/__integration__/**/*.test.tsx',
];

/**
 * `dom-fast` 레인 — 파일 이름으로 **명시적으로** 들어온다(`X.dom-fast.test.tsx`).
 *
 * `isolate: false`라 워커 하나가 여러 파일을 같은 모듈 캐시·같은 DOM 위에서 이어
 * 돌린다. 파일마다 환경을 새로 만들고 모듈을 다시 평가하는 비용이 사라져, 도입
 * 시점의 166개 파일이 한 자릿수 초로 끝난다(2026-10-04 로컬 실측 약 3초).
 *
 * 들어올 수 있는 조건:
 * - `vi.mock`·`vi.doMock`·`vi.hoisted`를 쓰지 않는다. 격리를 끄면 mock 레지스트리와
 *   평가된 모듈이 워커 안에서 공유돼, 한 파일의 모듈 목이 다음 파일로 샌다.
 * - 파일·`beforeAll` 스코프에 건 스파이·전역 스텁·가짜 타이머에 기대지 않는다 —
 *   `vitest.setup.dom-fast.ts`가 매 테스트 뒤에 되돌린다.
 * - 환경 주석(`@vitest-environment`)이 없다. 이 레인은 happy-dom 고정이다.
 *
 * 조건이 깨지면 접미사를 떼서 격리 레인(`dom`)으로 되돌린다. 기본값이 격리인 이유:
 * 새 테스트가 조건을 모르고 들어와도 안전한 쪽으로 떨어져야 한다.
 */
const DOM_FAST_TEST_PATTERNS = [
    'src/**/__tests__/**/*.dom-fast.test.tsx',
    'src/__integration__/**/*.dom-fast.test.tsx',
];

/**
 * dom 테스트의 기본 환경은 happy-dom이다(환경 준비가 jsdom보다 가벼워 dom 프로젝트가
 * 로컬 실측 82초 → 63초). jsdom 동작에 기대는 파일은 `// @vitest-environment jsdom`
 * 주석으로 파일 단위 전환한다 — 그 파일에도 같은 URL이 적용되도록 두 키를 다 둔다.
 */
const DOM_ENVIRONMENT_OPTIONS = {
    jsdom: { url: 'http://localhost:4200' },
    happyDOM: { url: 'http://localhost:4200' },
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
                    include: DOM_TEST_PATTERNS,
                    exclude: [
                        ...sharedTestConfig.exclude,
                        ...DOM_FAST_TEST_PATTERNS,
                    ],
                    environment: 'happy-dom',
                    environmentOptions: DOM_ENVIRONMENT_OPTIONS,
                },
            },
            {
                ...sharedConfig,
                test: {
                    ...sharedTestConfig,
                    name: 'dom-fast',
                    isolate: false,
                    setupFiles: [
                        './vitest.setup.dom.ts',
                        './vitest.setup.dom-fast.ts',
                    ],
                    include: DOM_FAST_TEST_PATTERNS,
                    environment: 'happy-dom',
                    environmentOptions: DOM_ENVIRONMENT_OPTIONS,
                },
            },
        ],
    },
});
