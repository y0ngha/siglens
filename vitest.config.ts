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
    coverage: {
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
        ],
        thresholds: {
            statements: 50,
            branches: 50,
            functions: 50,
            lines: 50,
        },
    },
};

export default defineConfig({
    ...sharedConfig,
    test: {
        ...sharedTestConfig,
        projects: [
            {
                ...sharedConfig,
                test: {
                    ...sharedTestConfig,
                    name: 'node',
                    include: ['src/**/__tests__/**/*.test.ts'],
                    environment: 'node',
                },
            },
            {
                ...sharedConfig,
                test: {
                    ...sharedTestConfig,
                    name: 'jsdom',
                    include: ['src/**/__tests__/**/*.test.tsx'],
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
