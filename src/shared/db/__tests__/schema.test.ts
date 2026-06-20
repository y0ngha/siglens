import * as schema from '@/shared/db/schema';

describe('schema 테이블 export', () => {
    const expectedTables = [
        'users',
        'sessions',
        'usageLogs',
        'oauthAccounts',
        'userApiKeys',
        'koreanTickers',
        'profileDescriptionTranslations',
        'assetTranslations',
        'inquiries',
        'news',
        'earningsReports',
        'terms',
        'agreements',
    ] as const;

    it.each(expectedTables)("'%s' 테이블이 export 되어 있다", tableName => {
        expect(schema[tableName]).toBeDefined();
    });

    it('각 테이블이 non-null 객체이다', () => {
        for (const tableName of expectedTables) {
            const table = schema[tableName];
            expect(typeof table).toBe('object');
            expect(table).not.toBeNull();
        }
    });
});

describe('schema enum export', () => {
    const expectedEnums = [
        'userTierEnum',
        'usageActionTypeEnum',
        'oauthProviderEnum',
        'llmProviderEnum',
        'termsKindEnum',
    ] as const;

    it.each(expectedEnums)("'%s' enum이 export 되어 있다", enumName => {
        expect(schema[enumName]).toBeDefined();
    });
});

describe('users 테이블 컬럼', () => {
    it('id, email, tier, createdAt, updatedAt 컬럼 속성이 존재한다', () => {
        const users = schema.users;
        expect(users.id).toBeDefined();
        expect(users.email).toBeDefined();
        expect(users.tier).toBeDefined();
        expect(users.createdAt).toBeDefined();
        expect(users.updatedAt).toBeDefined();
    });
});

describe('sessions 테이블 컬럼', () => {
    it('id, userId, expiresAt, createdAt 컬럼 속성이 존재한다', () => {
        const sessions = schema.sessions;
        expect(sessions.id).toBeDefined();
        expect(sessions.userId).toBeDefined();
        expect(sessions.expiresAt).toBeDefined();
        expect(sessions.createdAt).toBeDefined();
    });
});

describe('economicIndicatorTranslations 테이블 컬럼', () => {
    it('normalizedName, koreanName, source, updatedAt 컬럼 속성이 존재한다', () => {
        const cols = Object.keys(schema.economicIndicatorTranslations);
        expect(cols).toContain('normalizedName');
        expect(cols).toContain('koreanName');
        expect(cols).toContain('source');
        expect(cols).toContain('updatedAt');
    });
});
