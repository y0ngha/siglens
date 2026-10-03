import {
    isDatabaseConfigured,
    isDatabaseMissingAtBuild,
    readDatabaseConfig,
    tryReadDatabaseConfig,
} from '@/shared/db/config';

describe('readDatabaseConfig', () => {
    const originalEnv = process.env.DATABASE_URL;

    afterEach(() => {
        if (originalEnv !== undefined) {
            process.env.DATABASE_URL = originalEnv;
        } else {
            delete process.env.DATABASE_URL;
        }
    });

    it('DATABASE_URL이 설정되어 있으면 DatabaseConfig를 반환한다', () => {
        process.env.DATABASE_URL = 'postgres://localhost:5432/testdb';
        const config = readDatabaseConfig();
        expect(config).toEqual({
            databaseUrl: 'postgres://localhost:5432/testdb',
        });
    });

    it('DATABASE_URL이 없으면 에러를 던진다', () => {
        delete process.env.DATABASE_URL;
        expect(() => readDatabaseConfig()).toThrow('DATABASE_URL');
    });

    it('DATABASE_URL이 빈 문자열이면 에러를 던진다', () => {
        process.env.DATABASE_URL = '';
        expect(() => readDatabaseConfig()).toThrow('DATABASE_URL');
    });
});

describe('tryReadDatabaseConfig', () => {
    const originalEnv = process.env.DATABASE_URL;

    afterEach(() => {
        if (originalEnv !== undefined) {
            process.env.DATABASE_URL = originalEnv;
        } else {
            delete process.env.DATABASE_URL;
        }
    });

    it('DATABASE_URL이 설정되어 있으면 DatabaseConfig를 반환한다', () => {
        process.env.DATABASE_URL = 'postgres://localhost:5432/testdb';
        const config = tryReadDatabaseConfig();
        expect(config).toEqual({
            databaseUrl: 'postgres://localhost:5432/testdb',
        });
    });

    it('DATABASE_URL이 없으면 null을 반환한다', () => {
        delete process.env.DATABASE_URL;
        expect(tryReadDatabaseConfig()).toBeNull();
    });

    it('DATABASE_URL이 빈 문자열이면 null을 반환한다', () => {
        process.env.DATABASE_URL = '';
        expect(tryReadDatabaseConfig()).toBeNull();
    });
});

describe('isDatabaseConfigured', () => {
    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it('DATABASE_URL이 있으면 true다', () => {
        vi.stubEnv('DATABASE_URL', 'postgres://localhost:5432/testdb');
        vi.stubEnv('SIGLENS_OFFLINE_BUILD', '');
        expect(isDatabaseConfigured()).toBe(true);
    });

    it('DATABASE_URL이 없거나 비어 있으면 false다', () => {
        vi.stubEnv('SIGLENS_OFFLINE_BUILD', '');
        vi.stubEnv('DATABASE_URL', '');
        expect(isDatabaseConfigured()).toBe(false);
    });

    it('오프라인 빌드는 URL이 있어도 false다(Neon 어댑터가 차단한다)', () => {
        vi.stubEnv('DATABASE_URL', 'postgres://localhost:5432/testdb');
        vi.stubEnv('SIGLENS_OFFLINE_BUILD', '1');
        expect(isDatabaseConfigured()).toBe(false);
    });
});

describe('isDatabaseMissingAtBuild', () => {
    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it('빌드 단계 + DB 없음이면 true다', () => {
        vi.stubEnv('NEXT_PHASE', 'phase-production-build');
        vi.stubEnv('SIGLENS_OFFLINE_BUILD', '');
        vi.stubEnv('DATABASE_URL', '');
        expect(isDatabaseMissingAtBuild()).toBe(true);
    });

    it('빌드 단계라도 DB가 있으면 false다', () => {
        vi.stubEnv('NEXT_PHASE', 'phase-production-build');
        vi.stubEnv('SIGLENS_OFFLINE_BUILD', '');
        vi.stubEnv('DATABASE_URL', 'postgres://localhost:5432/testdb');
        expect(isDatabaseMissingAtBuild()).toBe(false);
    });

    it('오프라인 빌드는 빌드 단계에서 DB 없음으로 본다', () => {
        vi.stubEnv('NEXT_PHASE', 'phase-production-build');
        vi.stubEnv('SIGLENS_OFFLINE_BUILD', '1');
        vi.stubEnv('DATABASE_URL', 'postgres://localhost:5432/testdb');
        expect(isDatabaseMissingAtBuild()).toBe(true);
    });

    it('런타임(빌드 단계 아님)에는 DB가 없어도 false다', () => {
        vi.stubEnv('NEXT_PHASE', '');
        vi.stubEnv('SIGLENS_OFFLINE_BUILD', '');
        vi.stubEnv('DATABASE_URL', '');
        expect(isDatabaseMissingAtBuild()).toBe(false);
    });
});
