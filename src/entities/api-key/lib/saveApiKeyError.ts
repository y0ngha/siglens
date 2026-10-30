import type { ApiKeyActionErrorCode } from '@/shared/lib/types';

/** 저장소가 암호화 키 env를 못 읽을 때 던지는 오류인지 메시지로 식별한다. */
function isEncryptionKeyMisconfigured(error: Error): boolean {
    return error.message.includes('LLM_API_KEY_ENCRYPTION_KEY');
}

/** 값이 5자리 SQLSTATE 문자열을 `code`로 가진 객체인지 판별한다. */
function hasSqlStateCode(value: unknown): boolean {
    return (
        typeof value === 'object' &&
        value !== null &&
        'code' in value &&
        typeof value.code === 'string' &&
        /^[0-9A-Z]{5}$/.test(value.code)
    );
}

/**
 * Postgres 드라이버 오류인지 판별한다. `postgres-js`와 `pg`는 모두
 * `error.code`에 5자리 SQLSTATE(예: 유니크 위반 `23505`, 연결 실패 `08006`)를
 * 붙인다. 이 모양으로 DB 계층 장애와 그 밖의 예기치 못한 예외를 구분해,
 * 후자를 DB 문제로 오인시키지 않는다. Drizzle은 쿼리 실패를
 * `DrizzleQueryError`로 감싸 드라이버 오류를 `cause`에 두므로 한 단계 안쪽도 본다.
 */
function isLikelyDatabaseError(error: Error): boolean {
    return hasSqlStateCode(error) || hasSqlStateCode(error.cause);
}

/**
 * 키 저장(upsert) 중 던져진 값을 사용자에게 보일 오류 코드로 분류한다.
 * `saveApiKeyAction`이 코드별 로그·번역 문구를 고르는 데 쓴다.
 */
export function classifySaveApiKeyError(
    error: unknown
): Extract<
    ApiKeyActionErrorCode,
    'server_misconfigured' | 'storage_unavailable' | 'unknown'
> {
    if (!(error instanceof Error)) return 'unknown';
    if (isEncryptionKeyMisconfigured(error)) return 'server_misconfigured';
    if (isLikelyDatabaseError(error)) return 'storage_unavailable';
    return 'unknown';
}
