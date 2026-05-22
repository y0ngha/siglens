import { NeonDbError } from '@neondatabase/serverless';
import {
    NEON_TRANSIENT_RETRY,
    isNeonTransientError,
} from '@/infrastructure/db/isNeonTransientError';

function makeNeonError(message: string): NeonDbError {
    const err = new Error(message) as Error & { name: string };
    err.name = 'NeonDbError';
    // Cast to NeonDbError so callers receive the structural shape they expect.
    return err as unknown as NeonDbError;
}

describe('isNeonTransientError', () => {
    it('실제 NeonDbError 인스턴스(instanceof 경로)에서도 transient 로 인식한다', () => {
        // 진짜 NeonDbError 인스턴스를 던져 `instanceof NeonDbError` 분기까지
        // 커버한다. 위의 makeNeonError 헬퍼는 duck-typed (name 매칭) 분기만
        // 검증하므로 이 케이스가 instanceof 검증의 정식 경로다.
        const err = new NeonDbError(
            'Error connecting to database: TypeError: fetch failed'
        );
        expect(isNeonTransientError(err)).toBe(true);
    });

    it('NeonDbError "Error connecting to database" 메시지를 transient 로 인식한다', () => {
        const err = makeNeonError(
            'Error connecting to database: TypeError: fetch failed'
        );
        expect(isNeonTransientError(err)).toBe(true);
    });

    it('NeonDbError "fetch failed" 만 포함해도 transient 로 인식한다', () => {
        const err = makeNeonError('something went wrong: fetch failed');
        expect(isNeonTransientError(err)).toBe(true);
    });

    it('NeonDbError 라도 transient 키워드가 없으면 false 를 반환한다', () => {
        // Schema / constraint 위반은 재시도해도 동일하게 실패하므로 retry 대상이 아님.
        const err = makeNeonError(
            'duplicate key value violates unique constraint "news_pkey"'
        );
        expect(isNeonTransientError(err)).toBe(false);
    });

    it('cause 체인 안에 NeonDbError 가 있으면 walk 해서 찾는다', () => {
        const inner = makeNeonError(
            'Error connecting to database: TypeError: fetch failed'
        );
        const outer = new Error('Failed query: insert into ...') as Error & {
            cause?: unknown;
        };
        outer.cause = inner;
        expect(isNeonTransientError(outer)).toBe(true);
    });

    it('non-Neon Error 는 false 를 반환한다', () => {
        const plain = new Error('Error connecting to database: fetch failed');
        // 메시지가 transient 키워드를 포함해도 NeonDbError 가 아니면 retry 대상이 아님.
        expect(isNeonTransientError(plain)).toBe(false);
    });

    it('null / undefined / 비 Error 값은 false 를 반환한다', () => {
        expect(isNeonTransientError(null)).toBe(false);
        expect(isNeonTransientError(undefined)).toBe(false);
        expect(isNeonTransientError('fetch failed')).toBe(false);
        expect(isNeonTransientError({ message: 'fetch failed' })).toBe(false);
    });

    it('cause 체인이 self-referential 이어도 무한 루프 없이 종료된다', () => {
        const err = new Error('outer') as Error & { cause?: unknown };
        err.cause = err;
        expect(isNeonTransientError(err)).toBe(false);
    });
});

describe('NEON_TRANSIENT_RETRY', () => {
    it('3회 / 200ms / isNeonTransientError 정책으로 고정되어 있다', () => {
        expect(NEON_TRANSIENT_RETRY.maxRetries).toBe(3);
        expect(NEON_TRANSIENT_RETRY.baseDelayMs).toBe(200);
        expect(NEON_TRANSIENT_RETRY.isRetryable).toBe(isNeonTransientError);
    });
});
