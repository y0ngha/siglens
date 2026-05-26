import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import boundaries from 'eslint-plugin-boundaries';

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
                // ⚠️ src/pages/는 FSD composition layer 용도. Next.js 라우팅은 src/app/에서만 처리.
                // Next.js App Router 프로젝트에서 src/pages/ 파일 추가 시 Pages Router 활성화 주의.
                { type: 'pages', pattern: 'src/pages/*' },
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
                            // widgets 간 cross-import 허용: symbol-page가 chart/analysis/fear-greed 위젯을 조합하고,
                            // fundamental/news/options/overall이 symbol-page barrel에서 공통 hook(useDefaultModelId 등)을 소비.
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
            // widgets 간 cross-import: hook에 server-side 의존이 있어 barrel re-export 시
            // Jest ESM 해석 실패. deep path 허용으로 우회 (Phase 7).
            'src/widgets/**',
        ],
        rules: {
            'no-restricted-imports': [
                'error',
                {
                    patterns: [
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
            ],
        },
    },
]);

export default eslintConfig;
