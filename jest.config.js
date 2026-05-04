module.exports = {
    cacheDirectory: './.jest/cache',
    testEnvironment: 'node',
    setupFiles: ['<rootDir>/jest.setup.ts'],
    testMatch: ['<rootDir>/src/__tests__/**/*.+(test|spec).+(ts|tsx)'],
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
    // domain, infrastructure만 커버리지 측정
    collectCoverageFrom: [
        'src/domain/**/*.ts',
        'src/infrastructure/**/*.ts',
        '!src/**/*.d.ts',
        '!src/**/index.ts',
        '!src/**/types.ts',
    ],
    coverageThreshold: {
        global: {
            branches: 100,
            functions: 100,
            lines: 100,
            statements: 100,
        },
    },
};
