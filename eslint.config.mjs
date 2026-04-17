import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

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
]);

export default eslintConfig;
