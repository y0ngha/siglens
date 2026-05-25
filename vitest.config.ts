import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
    resolve: {
        alias: {
            '@': path.resolve(__dirname, 'src'),
        },
    },
    test: {
        globals: true,
        setupFiles: ['./vitest.setup.ts'],
        include: ['src/**/__tests__/**/*.{test,spec}.{ts,tsx}'],
        environment: 'node',
        environmentMatchGlobs: [
            ['**/*.test.tsx', 'jsdom'],
        ],
        coverage: {
            provider: 'v8',
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
            ],
            thresholds: {
                statements: 50,
                branches: 50,
                functions: 50,
                lines: 50,
            },
        },
    },
});
