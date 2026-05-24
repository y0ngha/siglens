module.exports = {
    cacheDirectory: './.jest/cache',
    testEnvironment: 'node',
    setupFiles: ['<rootDir>/jest.setup.ts'],
    testMatch: [
        // legacy mirror(src/__tests__/) + FSD colocated(src/<layer>/<slice>/__tests__/) 모두 커버
        '<rootDir>/src/**/__tests__/**/*.+(test|spec).+(ts|tsx)',
    ],
    transform: {
        '^.+\\.(t|j)sx?$': [
            'ts-jest',
            {
                tsconfig: 'tsconfig.json',
            },
        ],
    },
    moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
    },
    // github-slugger is ESM-only; transform it via ts-jest so Jest can consume it
    transformIgnorePatterns: ['/node_modules/(?!github-slugger)'],
    // 옛(domain, infrastructure) + 새 FSD layer(entities, features/lib, features/api, shared/lib) 측정.
    // features/model — 주로 타입 정의이므로 의도적 제외. features/hooks — UI 훅이므로 optional.
    // UI 레이어(widgets, pages, app)는 제외.
    collectCoverageFrom: [
        'src/domain/**/*.ts',
        'src/infrastructure/**/*.ts',
        'src/entities/**/*.ts',
        'src/features/**/lib/**/*.ts',
        'src/features/**/api/**/*.ts',
        'src/shared/lib/**/*.ts',
        '!src/**/*.d.ts',
        '!src/**/index.ts',
        '!src/**/types.ts',
    ],
    coverageThreshold: {
        global: {
            branches: 90,
            functions: 90,
            lines: 90,
            statements: 90,
        },
    },
};
