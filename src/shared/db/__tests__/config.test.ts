import { readDatabaseConfig, tryReadDatabaseConfig } from '@/shared/db/config';

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
