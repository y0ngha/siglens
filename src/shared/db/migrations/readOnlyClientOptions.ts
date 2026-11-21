import type { ReadOnlyClientOptions } from '@/shared/db/migrations/types';

/**
 * 점검 CLI(`db/scripts/checkMigrations.ts`)가 쓰는 postgres-js 옵션.
 *
 * `default_transaction_read_only`는 연결 시작 파라미터로 서버에 간다(postgres-js가 `true`를
 * 문자열 `'true'`로 보낸다. Postgres는 boolean GUC에 이 값을 받는다). 세션이 읽기 전용이라
 * 쓰기는 서버가 25006으로 거부한다. 그래서 점검 CLI는 쓰기 가드(`assertRemoteWriteAllowed`)를
 * 부르지 않는다. 이 옵션이 빠지면 그 전제가 조용히 무너지므로 테스트가 값을 고정한다.
 */
export function readOnlyClientOptions(): ReadOnlyClientOptions {
    return {
        max: 1,
        connect_timeout: 10,
        connection: { default_transaction_read_only: true },
    };
}
