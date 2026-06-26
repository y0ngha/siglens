import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import boundaries from 'eslint-plugin-boundaries';
import { defineConfig, globalIgnores } from 'eslint/config';

const eslintConfig = defineConfig([
    ...nextVitals,
    ...nextTs,
    // Override default ignores of eslint-config-next.
    globalIgnores([
        // Default ignores of eslint-config-next:
        '.next/**',
        'out/**',
        'build/**',
        'next-env.d.ts',
        // Worker build artifacts and tooling
        'worker/.yarn/**',
        'worker/.vscode/**',
        'worker/dist/**',
        // Tooling config directories
        '.agents/**',
        '.claude/**',
        '.superpowers/**',
        'worker/.pnp.cjs',
        'coverage/**',
        'playwright-report/**',
    ]),
    {
        // JSON-LD structured data injection via dangerouslySetInnerHTML on <script> elements
        // is a standard Next.js pattern for SEO. The data is server-generated and safe.
        files: ['src/app/page.tsx', 'src/app/[symbol]/page.tsx'],
        rules: {
            'react/no-danger': 'off',
        },
    },
    {
        // Declaration merging in .d.ts uses empty interfaces (extends-only) by design.
        files: ['**/*.d.ts'],
        rules: {
            '@typescript-eslint/no-empty-object-type': 'off',
        },
    },
    {
        // Playwright E2E support/specs are not React. The `react-hooks/rules-of-hooks`
        // rule misfires on Playwright's fixture `use()` callback (it treats the
        // parameter named `use` as a React Hook). Disable React-specific rules here.
        files: ['e2e/**/*.{ts,tsx}'],
        rules: {
            'react-hooks/rules-of-hooks': 'off',
        },
    },
    {
        // eslint-plugin-react-hooks v7.1.1 (React Compiler lint mode) propagates
        // setState tracking through useEffectEvent, causing set-state-in-effect to
        // fire on the canonical `useEffect(() => { effectEventFn(); }, [])` pattern.
        // This is a false positive: useEffectEvent is the React 19 blessed way to read
        // latest state/props in a mount-only effect without adding reactive deps.
        // The URL-restore-on-mount pattern here is a legitimate external-system sync
        // (URLSearchParams → React state), not a cascading-render anti-pattern.
        //
        // usePersistentState: mount-only effect reads localStorage (external system)
        // and restores state once. This is the canonical SSR-safe hydration pattern —
        // server renders initial value, client mount syncs from the external store.
        files: [
            'src/widgets/dashboard/hooks/useSectorSignalState.ts',
            'src/shared/hooks/usePersistentState.ts',
        ],
        rules: {
            'react-hooks/set-state-in-effect': 'off',
        },
    },
    {
        // These factories / actions use a runtime require() to keep the E2E-only
        // postgres-js client / fake market provider / analysis stub + JSON fixture
        // out of the production bundle (a static import would bundle them; async
        // import would force every synchronous caller to await). The submit
        // actions require('@/shared/api/e2eAnalysisStub') only under the inline
        // E2E_TEST guard, matching getMarketDataProvider's require-gate.
        files: [
            'src/shared/db/client.ts',
            'src/shared/api/market/getMarketDataProvider.ts',
            'src/shared/api/economy/getEconomyProvider.ts',
            'src/shared/api/fmp/getFundamentalDataProvider.ts',
            'src/shared/api/fmp/getFinancialStatementsProvider.ts',
            'src/shared/api/fmp/getCongressTradesProvider.ts',
            'src/entities/analysis/actions/submitAnalysisAction.ts',
            'src/entities/analysis/actions/submitOverallAnalysisAction.ts',
            'src/entities/analysis/actions/submitFundamentalAnalysisAction.ts',
            'src/entities/news-article/actions/submitNewsAnalysisAction.ts',
            'src/entities/news-article/lib/getNewsClient.ts',
            'src/entities/market-news/lib/getMarketNewsClient.ts',
            'src/entities/options-chain/actions/optionsActions.ts',
            'src/entities/options-chain/lib/getOptionsProvider.ts',
        ],
        rules: { '@typescript-eslint/no-require-imports': 'off' },
    },
    {
        // Variables and parameters prefixed with _ are intentionally unused
        // (kept for future use, documented with TODO comments).
        rules: {
            '@typescript-eslint/no-unused-vars': [
                'warn',
                {
                    argsIgnorePattern: '^_',
                    varsIgnorePattern: '^_',
                    caughtErrorsIgnorePattern: '^_',
                    destructuredArrayIgnorePattern: '^_',
                },
            ],
        },
    },
    {
        plugins: { boundaries },
        settings: {
            'boundaries/elements': [
                // FSD 6-layer
                // ⚠️ src/views/는 FSD composition layer 용도. Next.js 라우팅은 src/app/에서만 처리.
                // src/pages/ 대신 src/views/ 사용: App Router에서 src/pages/ 추가 시 Pages Router 활성화됨.
                { type: 'pages', pattern: 'src/views/*' },
                { type: 'widgets', pattern: 'src/widgets/*' },
                { type: 'features', pattern: 'src/features/*' },
                { type: 'entities', pattern: 'src/entities/*' },
                { type: 'shared', pattern: 'src/shared/**' },
                // app layer (Next.js App Router)
                { type: 'app', pattern: 'src/app/**' },
            ],
        },
        rules: {
            'boundaries/dependencies': [
                'error',
                {
                    default: 'disallow',
                    rules: [
                        {
                            from: { type: 'pages' },
                            allow: [
                                { to: { type: 'widgets' } },
                                { to: { type: 'features' } },
                                { to: { type: 'entities' } },
                                { to: { type: 'shared' } },
                            ],
                        },
                        {
                            // widgets 간 cross-import 허용: Spec-2 PR-B2에서 symbol-page가 src/views/symbol/로 이관되어
                            // 해당 엣지는 제거됨. 현재 허용 목적은 두 pre-existing 엣지에 한정:
                            //   - fear-greed → chart: FearGreedPage.tsx가 @/widgets/chart/FearGreedHistoricalChart를 deep import
                            //   - overall → news: OverallContent.tsx가 @/widgets/news barrel에서 useNewsAnalysisTrigger/useWaitForNewsCards를 소비
                            // 두 엣지 모두 symbol-page와 무관. 규칙 완전 제거는 해당 컴포넌트 이전이 선행되어야 하므로 보류.
                            from: { type: 'widgets' },
                            allow: [
                                { to: { type: 'widgets' } },
                                { to: { type: 'features' } },
                                { to: { type: 'entities' } },
                                { to: { type: 'shared' } },
                            ],
                        },
                        {
                            // auth 슬라이스 간 cross-import 허용.
                            // 허용 쌍: auth-signup → auth-email-verification, auth-oauth-consent → auth-signup
                            from: { type: 'features' },
                            allow: [
                                { to: { type: 'features' } },
                                { to: { type: 'entities' } },
                                { to: { type: 'shared' } },
                            ],
                        },
                        {
                            // entities 간 cross-import 허용. submitOverallAnalysisAction (analysis)이
                            // news-article, earnings-report 데이터를 조합하는 등 entity 간 의존이 불가피.
                            from: { type: 'entities' },
                            allow: [
                                { to: { type: 'entities' } },
                                { to: { type: 'shared' } },
                            ],
                        },
                        {
                            from: { type: 'shared' },
                            // byokGate가 shared/lib/에서 entities(api-key, user)를 참조.
                            allow: [
                                { to: { type: 'shared' } },
                                { to: { type: 'entities' } },
                            ],
                        },
                        {
                            from: { type: 'app' },
                            allow: [
                                { to: { type: 'pages' } },
                                { to: { type: 'widgets' } },
                                { to: { type: 'features' } },
                                { to: { type: 'entities' } },
                                { to: { type: 'shared' } },
                            ],
                        },
                    ],
                },
            ],
        },
    },
    {
        files: ['src/**/*.{ts,tsx}'],
        ignores: [
            'src/**/*.test.{ts,tsx}',
            'src/**/__tests__/**',
            // Phase 5: Server Actions는 entity/feature 내부 구현에 접근해야 하므로
            // deep import 제한에서 제외. jest.mock 경로 일관성도 보장.
            'src/features/*/actions/**',
            'src/entities/*/actions/**',
            // entities 내부 lib 간 cross-import는 barrel 순환을 피하기 위해 deep path 사용.
            'src/entities/*/lib/**',
            // Route handlers와 RSC pages는 서버 전용 코드로 entity/feature 내부 구현 접근 필요.
            // RSC pages가 server-only lib 경로를 import해야 하므로 ('use server' 파일이 아닌)
            // 예: getCurrentUser, optionsDataCache 등 server-only 마킹된 함수들
            'src/app/**/!(api)/**',
            'src/app/*.tsx',
            // widgets 간 cross-import: Spec-2 PR-B2 이후 symbol-page 엣지는 제거됨.
            // 잔존 deep-import: fear-greed → @/widgets/chart/FearGreedHistoricalChart
            //   (barrel에서 제외된 heavy-chart 컴포넌트, server-side 의존으로 re-export 시 Jest ESM 해석 실패).
            // barrel 소비 엣지(overall → @/widgets/news)도 이 ignore 범위 내에서 허용됨 (Phase 7).
            'src/widgets/**',
            // views composition layer: symbol-page 이관(Spec-2 PR-B2) 후 ChartContent/useAnalysis가
            // @/widgets/analysis/hooks/* + @/widgets/analysis/model/* deep import를 유지해야 한다.
            // barrel에 없는 CooldownNotice(model/types), useAnalysisProgress(hooks/) 때문.
            'src/views/**',
            // byokGate는 import 'server-only' 선언 + src/shared/CLAUDE.md §의도적 예외 (shared → entities)에서
            // 허용된 shared → entities 의존성을 가진다. barrel에서 제외된 api-key/api deep import
            // 가 필요하므로 no-restricted-imports 예외로 추가한다.
            'src/shared/lib/byokGate.ts',
            // instrumentation*.ts는 Next 서버 전용 런타임 훅(SIGTERM graceful-drain)이다.
            // drain 유틸(drainBackgroundTasks/stopAcceptingBackgroundTasks)은 server-only라
            // client 번들에 포함되는 ticker barrel에 노출할 수 없어 lib 경로에서 deep import해야 한다.
            'src/instrumentation.ts',
            'src/instrumentation.node.ts',
        ],
        rules: {
            'no-restricted-imports': [
                'error',
                {
                    // patterns entries must be uniform (all objects here): mixing
                    // plain strings with { group } objects is rejected by the schema.
                    patterns: [
                        {
                            group: [
                                // features — barrel + deep path
                                '@/features/*/model',
                                '@/features/*/model/*',
                                '@/features/*/hooks',
                                '@/features/*/hooks/*',
                                '@/features/*/ui',
                                '@/features/*/ui/*',
                                '@/features/*/lib',
                                '@/features/*/lib/*',
                                '@/features/*/api',
                                '@/features/*/api/*',
                                // widgets — barrel + deep path
                                '@/widgets/*/ui',
                                '@/widgets/*/ui/*',
                                '@/widgets/*/hooks',
                                '@/widgets/*/hooks/*',
                                '@/widgets/*/lib',
                                '@/widgets/*/lib/*',
                                '@/widgets/*/model', // widgets 설계에 model 없음, 방어적 차단
                                '@/widgets/*/model/*',
                                // entities — barrel + deep path (actions 제외: 'use server')
                                '@/entities/*/api',
                                '@/entities/*/api/*',
                                '@/entities/*/model',
                                '@/entities/*/model/*',
                                '@/entities/*/lib',
                                '@/entities/*/lib/*',
                                '@/entities/*/ui',
                                '@/entities/*/ui/*',
                                // siglens-core deep import 차단 (CLAUDE.md / ARCHITECTURE.md 정책)
                                '@y0ngha/siglens-core/dist',
                                '@y0ngha/siglens-core/dist/*',
                            ],
                        },
                        // E2E-only fixtures/helpers (@e2e/*) must not leak into the
                        // production src bundle. Sole exception: FakeMarketProvider.ts
                        // (E2E_TEST-gated fake provider) — overridden below.
                        {
                            group: ['@e2e/*'],
                            message:
                                'src/는 E2E 전용 모듈(@e2e/*)을 import할 수 없습니다. 프로덕션 번들 유출 방지. (예외: FakeMarketProvider.ts)',
                        },
                    ],
                },
            ],
        },
    },
    {
        // FakeMarketProvider / e2eAnalysisStub는 E2E_TEST 게이트 뒤에서
        // @e2e/fixtures/*.json을 소비하는 합법 consumer다. @e2e/* 금지만 제외하고
        // 나머지 FSD/deep-import 제한은 그대로 유지한다 (위 src/** 블록의 patterns를
        // @e2e 그룹만 빼고 재명시).
        files: [
            'src/shared/api/market/FakeMarketProvider.ts',
            'src/shared/api/e2eAnalysisStub.ts',
        ],
        rules: {
            'no-restricted-imports': [
                'error',
                {
                    patterns: [
                        {
                            group: [
                                // features — barrel + deep path
                                '@/features/*/model',
                                '@/features/*/model/*',
                                '@/features/*/hooks',
                                '@/features/*/hooks/*',
                                '@/features/*/ui',
                                '@/features/*/ui/*',
                                '@/features/*/lib',
                                '@/features/*/lib/*',
                                '@/features/*/api',
                                '@/features/*/api/*',
                                // widgets — barrel + deep path
                                '@/widgets/*/ui',
                                '@/widgets/*/ui/*',
                                '@/widgets/*/hooks',
                                '@/widgets/*/hooks/*',
                                '@/widgets/*/lib',
                                '@/widgets/*/lib/*',
                                '@/widgets/*/model',
                                '@/widgets/*/model/*',
                                // entities — barrel + deep path (actions 제외: 'use server')
                                '@/entities/*/api',
                                '@/entities/*/api/*',
                                '@/entities/*/model',
                                '@/entities/*/model/*',
                                '@/entities/*/lib',
                                '@/entities/*/lib/*',
                                '@/entities/*/ui',
                                '@/entities/*/ui/*',
                                // siglens-core deep import 차단 (CLAUDE.md / ARCHITECTURE.md 정책)
                                '@y0ngha/siglens-core/dist',
                                '@y0ngha/siglens-core/dist/*',
                            ],
                        },
                    ],
                },
            ],
        },
    },
]);

export default eslintConfig;
