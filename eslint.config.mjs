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
                            from: 'features',
                            allow: [
                                'entities',
                                'shared',
                                'legacy-domain',
                                'legacy-infra',
                                'legacy-lib',
                            ],
                        },
                        {
                            from: 'entities',
                            allow: [
                                'shared',
                                'legacy-domain',
                                'legacy-infra',
                                'legacy-lib',
                            ],
                        },
                        { from: 'shared', allow: ['shared'] },
                        // 옛 layer 간 의존: 현재 코드 그대로 허용
                        {
                            from: 'legacy-app',
                            allow: [
                                'legacy-comp',
                                'legacy-domain',
                                'legacy-infra',
                                'legacy-lib',
                                'shared',
                            ],
                        },
                        {
                            from: 'legacy-comp',
                            allow: [
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
                            from: 'legacy-infra',
                            allow: ['legacy-domain', 'legacy-lib', 'shared'],
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
        ignores: ['src/**/*.test.{ts,tsx}', 'src/**/__tests__/**'],
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
                        // entities — barrel + deep path (actions 제외: 'use server')
                        '@/entities/*/api',
                        '@/entities/*/api/*',
                        '@/entities/*/model',
                        '@/entities/*/model/*',
                        '@/entities/*/lib',
                        '@/entities/*/lib/*',
                        '@/entities/*/ui',
                        '@/entities/*/ui/*',
                    ],
                },
            ],
        },
    },
]);

export default eslintConfig;
