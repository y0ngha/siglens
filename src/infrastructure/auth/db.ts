import { createDatabaseClient } from '@y0ngha/siglens-core';

type DatabaseClient = ReturnType<typeof createDatabaseClient>;

let cachedClient: DatabaseClient | null = null;

/** 인증 DB 접근용 모듈 캐시된 DatabaseClient. DATABASE_URL이 비어 있으면 throw. */
export function getAuthDatabaseClient(): DatabaseClient {
    if (cachedClient !== null) return cachedClient;
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
        throw new Error('DATABASE_URL is not configured');
    }
    cachedClient = createDatabaseClient({ databaseUrl });
    return cachedClient;
}

/** @internal 테스트에서 모듈 캐시를 초기화한다. */
export function resetAuthDatabaseClientForTests(): void {
    cachedClient = null;
}
