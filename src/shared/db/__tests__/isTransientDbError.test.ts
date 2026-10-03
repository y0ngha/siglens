import postgres from 'postgres';
import {
    DB_TRANSIENT_RETRY,
    isTransientDbError,
} from '@/shared/db/isTransientDbError';

/**
 * postgres-js가 서버 에러를 만드는 방식 그대로 — 런타임 생성자는 응답 필드 객체를 받아
 * `Object.assign`한다(`src/errors.js`). 선언 타입은 `string`이라 캐스트가 필요하다.
 */
function makePostgresError(code?: string, message = 'server error') {
    return new postgres.PostgresError({
        code,
        message,
    } as unknown as string);
}

/** postgres-js `Errors.connection` / node 소켓 에러 모양: `name`은 'Error', `code`만 다르다. */
function makeConnectionError(code: string): Error {
    return Object.assign(new Error(`write ${code} db.example:5432`), { code });
}

describe('isTransientDbError', () => {
    describe('PostgresError (서버가 돌려준 SQLSTATE)', () => {
        it.each([
            ['57P01', 'admin_shutdown'],
            ['57P02', 'crash_shutdown'],
            ['57P03', 'cannot_connect_now'],
            ['08000', 'connection_exception'],
            ['08006', 'connection_failure'],
            ['08003', 'connection_does_not_exist'],
            ['08001', 'sqlclient_unable_to_establish_sqlconnection'],
            ['08004', 'sqlserver_rejected_establishment_of_sqlconnection'],
            ['53300', 'too_many_connections'],
        ])('code=%s (%s)는 transient다', (code, _description) => {
            expect(isTransientDbError(makePostgresError(code))).toBe(true);
        });

        it('name만 PostgresError인 duck-typed 에러도 인식한다(모듈 인스턴스 분리 대비)', () => {
            const err = Object.assign(new Error('terminating connection'), {
                name: 'PostgresError',
                code: '57P01',
            });
            expect(isTransientDbError(err)).toBe(true);
        });

        it('23505 unique_violation은 transient가 아니다', () => {
            const err = makePostgresError(
                '23505',
                'duplicate key value violates unique constraint "news_pkey"'
            );
            expect(isTransientDbError(err)).toBe(false);
        });

        it('SQLSTATE가 메시지에만 있고 code 필드가 없으면 transient가 아니다', () => {
            expect(
                isTransientDbError(
                    makePostgresError(
                        undefined,
                        'terminating connection (code 57P01)'
                    )
                )
            ).toBe(false);
        });

        it('PostgresError가 아닌 에러의 SQLSTATE 형 code는 무시한다', () => {
            const err = Object.assign(new Error('weird'), { code: '57P01' });
            expect(isTransientDbError(err)).toBe(false);
        });
    });

    describe('연결 계열 에러 (postgres-js / node 소켓)', () => {
        it.each([
            'CONNECTION_CLOSED',
            'CONNECTION_ENDED',
            'CONNECTION_DESTROYED',
            'CONNECT_TIMEOUT',
            'ECONNRESET',
            'ECONNREFUSED',
            'ETIMEDOUT',
            'EPIPE',
            'EAI_AGAIN',
            'ENETUNREACH',
            'EHOSTUNREACH',
        ])('code=%s 는 transient다', code => {
            expect(isTransientDbError(makeConnectionError(code))).toBe(true);
        });

        it('PostgresError에 연결 코드가 얹혀도 SQLSTATE 집합으로만 판정한다', () => {
            expect(
                isTransientDbError(makePostgresError('CONNECTION_CLOSED'))
            ).toBe(false);
        });

        it('알 수 없는 code는 transient가 아니다', () => {
            expect(isTransientDbError(makeConnectionError('ENOENT'))).toBe(
                false
            );
        });
    });

    describe('cause 체인', () => {
        it('drizzle이 감싼 `Failed query` 에러의 cause에서 PostgresError를 찾는다', () => {
            const outer = new Error('Failed query: insert into ...', {
                cause: makePostgresError('57P01'),
            });
            expect(isTransientDbError(outer)).toBe(true);
        });

        it('cause 안의 연결 에러도 찾는다', () => {
            const outer = new Error('Failed query: select ...', {
                cause: makeConnectionError('CONNECTION_CLOSED'),
            });
            expect(isTransientDbError(outer)).toBe(true);
        });

        it('cause 안의 비-transient 에러는 false다', () => {
            const outer = new Error('Failed query: insert ...', {
                cause: makePostgresError('23505'),
            });
            expect(isTransientDbError(outer)).toBe(false);
        });

        it('자기 자신을 가리키는 cause에서도 무한 루프 없이 종료한다', () => {
            const err = new Error('outer') as Error & { cause?: unknown };
            err.cause = err;
            expect(isTransientDbError(err)).toBe(false);
        });
    });

    it('Error가 아닌 값은 false다', () => {
        expect(isTransientDbError(null)).toBe(false);
        expect(isTransientDbError(undefined)).toBe(false);
        expect(isTransientDbError('CONNECTION_CLOSED')).toBe(false);
        expect(isTransientDbError({ code: 'CONNECTION_CLOSED' })).toBe(false);
    });

    it('code 없는 일반 Error는 false다', () => {
        expect(isTransientDbError(new Error('fetch failed'))).toBe(false);
    });
});

describe('DB_TRANSIENT_RETRY', () => {
    it('3회 / 200ms / 5s budget / isTransientDbError 정책으로 고정되어 있다', () => {
        expect(DB_TRANSIENT_RETRY.maxRetries).toBe(3);
        expect(DB_TRANSIENT_RETRY.baseDelayMs).toBe(200);
        expect(DB_TRANSIENT_RETRY.isRetryable).toBe(isTransientDbError);
        // 최악 시 backoff sleeps: 200+400+800 = 1.4s + 1×jitter ≈ 2.8s.
        expect(DB_TRANSIENT_RETRY.backoffBudgetMs).toBe(5000);
    });
});
