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
                // 새 FSD layer (Phase 0에서는 디렉토리가 아직 생성되지 않음)
                // ⚠️ src/pages/는 FSD composition layer 용도. Next.js 라우팅은 src/app/에서만 처리.
                // Next.js App Router 프로젝트에서 src/pages/ 파일 추가 시 Pages Router 활성화 주의.
                { type: 'pages', pattern: 'src/pages/*' },
                { type: 'widgets', pattern: 'src/widgets/*' },
                { type: 'features', pattern: 'src/features/*' },
                { type: 'entities', pattern: 'src/entities/*' },
                { type: 'shared', pattern: 'src/shared/**' },
                // 옛 layer (Phase 1~9 동안 점진 제거)
                { type: 'legacy-app', pattern: 'src/app/**' },
                { type: 'legacy-comp', pattern: 'src/components/**' },
                { type: 'legacy-domain', pattern: 'src/domain/**' },
                { type: 'legacy-infra', pattern: 'src/infrastructure/**' },
                { type: 'legacy-lib', pattern: 'src/lib/**' },
            ],
        },
        rules: {
            'boundaries/element-types': [
                'error',
                {
                    default: 'disallow',
                    rules: [
                        {
                            from: 'pages',
                            allow: [
                                'widgets',
                                'features',
                                'entities',
                                'shared',
                                'legacy-comp',
                                'legacy-domain',
                                'legacy-infra',
                                'legacy-lib',
                            ],
                        },
                        {
                            from: 'widgets',
                            allow: [
                                'features',
                                'entities',
                                'shared',
                                'legacy-comp',
                                'legacy-domain',
                                'legacy-infra',
                                'legacy-lib',
                            ],
                        },
                        {
                            // Phase 5 임시 허용 — auth 슬라이스 간 cross-import.
                            // 허용 쌍: auth-signup → auth-email-verification, auth-oauth-consent → auth-signup
                            // TODO(Phase 7): 공유 로직을 entities/shared로 추출하여 해소.
                            from: 'features',
                            allow: [
                                'features',
                                'entities',
                                'shared',
                                'legacy-comp', // 마이그레이션 중 임시 허용: 새 feature가 아직 widgets로 이동하지 않은 legacy UI를 사용. Phase 7 완료 시 제거.
                                'legacy-domain',
                                'legacy-infra',
                                'legacy-lib',
                            ],
                        },
                        {
                            // Phase 3: entities 간 cross-import 허용. submitOverallAnalysisAction (analysis)이
                            // news-article, earnings-report 데이터를 조합하는 등 entity 간 의존이 불가피.
                            // Phase 9 (features 분리) 완료 시 entities 자체 제거하고 재평가.
                            from: 'entities',
                            allow: [
                                'entities',
                                'shared',
                                'legacy-domain',
                                'legacy-infra',
                                'legacy-lib',
                            ],
                        },
                        {
                            from: 'shared',
                            // 마이그레이션 중 임시 허용: shared로 이동한 파일이 아직 legacy-domain 타입/상수를 참조.
                            // Phase 3: byokGate가 shared/lib/로 이동하면서 entities(api-key, user)와
                            // legacy-infra(tier)를 참조. Phase 5 (features 분리) 완료 시 entities/legacy-infra 제거.
                            allow: [
                                'shared',
                                'entities',
                                'legacy-domain',
                                'legacy-infra',
                            ],
                        },
                        // 옛 layer 간 의존: 현재 코드 그대로 허용
                        {
                            from: 'legacy-app',
                            allow: [
                                'pages',
                                'widgets',
                                'features',
                                'entities',
                                'shared',
                                'legacy-comp',
                                'legacy-domain',
                                'legacy-infra',
                                'legacy-lib',
                            ],
                        },
                        {
                            // legacy-comp → legacy-infra: 옛 코드 현상 유지 (현상 유지 허용).
                            // .tsx 파일의 직접 infrastructure import는 ARCHITECTURE.md 규칙으로 별도 차단되며,
                            // 이 boundaries 규칙은 hooks/와 .tsx를 구분하지 않음.
                            // Phase 7 (widgets 마이그레이션) 완료 시 legacy-comp 타입 제거.
                            from: 'legacy-comp',
                            allow: [
                                // Phase 5+: components hooks가 entities actions/hooks 및 features barrel을 import 필요.
                                // HeaderUserMenu → auth-logout 등. Phase 7 (widgets 마이그레이션) 완료 시 legacy-comp 자체 제거.
                                'features',
                                'entities',
                                'legacy-domain',
                                'legacy-infra',
                                'legacy-lib',
                                'shared',
                            ],
                        },
                        {
                            from: 'legacy-domain',
                            allow: ['legacy-lib', 'shared'],
                        },
                        {
                            // Phase 2: repositories가 entities로 이동하면서 legacy-infra에서 entity import 필요.
                            // Phase 5 (features auth) 완료 시 legacy-infra 의존 자체가 사라짐.
                            from: 'legacy-infra',
                            allow: [
                                'entities',
                                'legacy-domain',
                                'legacy-lib',
                                'shared',
                            ],
                        },
                        {
                            from: 'legacy-lib',
                            allow: ['legacy-domain', 'shared'],
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
            // Route handlers는 서버 전용 코드로 entity/feature 내부 구현 접근 필요.
            'src/app/api/**',
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
