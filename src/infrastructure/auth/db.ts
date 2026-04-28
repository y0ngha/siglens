import { createDatabaseClient } from '@y0ngha/siglens-core';

type DatabaseClient = ReturnType<typeof createDatabaseClient>;

let cachedClient: DatabaseClient | null = null;

/**
 * 인증 관련 DB 접근에 사용하는 모듈 캐시된 DatabaseClient 핸들.
 * DATABASE_URL이 비어 있으면 명시적으로 throw한다.
 */
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
