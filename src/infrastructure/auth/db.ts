import {
    getDatabaseClient,
    resetDatabaseClientForTests,
} from '@/infrastructure/db/client';
import type { DatabaseClient } from '@/infrastructure/db/types';

/** 인증 DB 접근용 모듈 캐시된 DatabaseClient. DATABASE_URL이 비어 있으면 throw. */
export function getAuthDatabaseClient(): DatabaseClient {
    return getDatabaseClient();
}

/** @internal 테스트에서 모듈 캐시를 초기화한다. */
export function resetAuthDatabaseClientForTests(): void {
    resetDatabaseClientForTests();
}
