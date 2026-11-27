import { describe, expect, it } from 'vitest';
import {
    isDatabaseError,
    redactDbErrorForLog,
    redactedErrorMessage,
} from '@/shared/db/redactDbErrorForLog';
import {
    PLANTED_EMAIL,
    PLANTED_TOKEN,
} from '@/shared/test-utils/plantedDbError';

/**
 * 로컬 클래스를 두는 이유: 이 파일은 **생성자 이름**(`DrizzleQueryError`)으로 잡는 분기와 `query`·`params` 필드를
 * 따로 시험한다. 공용 `plantedDbError()`는 메시지 모양만 갖는 평범한 `Error`라 그 분기를 거치지 않는다.
 * drizzle-orm 0.45의 실제 모양: `name`은 `Error`, 메시지에 파라미터가 들어간다.
 */
class DrizzleQueryError extends Error {
    constructor(
        readonly query: string,
        readonly params: unknown[],
        cause?: Error
    ) {
        super(`Failed query: ${query}\nparams: ${params.join(',')}`);
        this.cause = cause;
    }
}

describe('redactDbErrorForLog', () => {
    it('drizzle 에러는 이름과 cause의 코드만 남기고 파라미터를 지운다', () => {
        const driver = Object.assign(new Error('duplicate key'), {
            code: '23505',
        });
        const error = new DrizzleQueryError(
            'select from sessions where id = $1 and email = $2',
            [PLANTED_TOKEN, PLANTED_EMAIL],
            driver
        );
        const out = redactDbErrorForLog(error);
        expect(out).toBe('Error code=23505');
        expect(JSON.stringify(out)).not.toContain(PLANTED_TOKEN);
        expect(JSON.stringify(out)).not.toContain(PLANTED_EMAIL);
    });

    it('DB 에러를 cause로 감싼 바깥 에러도 통째로 지운다', () => {
        const inner = new DrizzleQueryError('select 1 where x = $1', [
            PLANTED_TOKEN,
        ]);
        const outer = new Error('session lookup failed', { cause: inner });
        expect(redactDbErrorForLog(outer)).toBe('Error code=none');
    });

    it('AggregateError 안의 DB 에러도 찾는다', () => {
        const inner = new DrizzleQueryError('select 1 where x = $1', [
            PLANTED_TOKEN,
        ]);
        const aggregate = new AggregateError([new Error('other'), inner]);
        expect(redactDbErrorForLog(aggregate)).toBe('AggregateError code=none');
    });

    it.each([
        ['메시지가 Failed query로 시작한다', new Error('Failed query: x')],
        [
            'name이 PostgresError다',
            Object.assign(new Error('x'), { name: 'PostgresError' }),
        ],
        [
            'SQLSTATE code와 severity를 갖는다(postgres.js)',
            Object.assign(new Error('x'), { code: '23505', severity: 'ERROR' }),
        ],
        [
            'SQLSTATE code와 routine을 갖는다',
            Object.assign(new Error('x'), { code: '23505', routine: 'r' }),
        ],
        [
            'P0001 code와 PostgresError 이름을 갖는다',
            Object.assign(new Error('x'), {
                name: 'PostgresError',
                code: 'P0001',
            }),
        ],
        [
            'DatabaseError(pg) 이름과 SQLSTATE code를 갖는다',
            Object.assign(new Error('x'), {
                name: 'DatabaseError',
                code: 'XX000',
            }),
        ],
        [
            'query와 parameters를 갖는다(postgres.js)',
            Object.assign(new Error('x'), {
                query: 'select 1',
                parameters: [PLANTED_TOKEN],
            }),
        ],
        [
            'query와 params를 갖는다',
            Object.assign(new Error('x'), { query: 'select 1', params: [] }),
        ],
    ])('구조 신호: %s', (_label, error) => {
        expect(isDatabaseError(error)).toBe(true);
        expect(redactDbErrorForLog(error)).not.toBe(error);
    });

    it('DB 에러가 아니면 같은 참조를 그대로 돌려준다', () => {
        const fetchError = Object.assign(new Error('FMP 429'), {
            code: 'ECONNRESET',
        });
        expect(redactDbErrorForLog(fetchError)).toBe(fetchError);
        const text = 'not an error';
        expect(redactDbErrorForLog(text)).toBe(text);
        expect(redactDbErrorForLog(undefined)).toBeUndefined();
    });

    it('Node errno와 postgres-js 연결 코드는 DB 에러로 보지 않는다', () => {
        const codes = ['EPIPE', 'ETIMEDOUT', 'CONNECT_TIMEOUT'];
        codes.forEach(code => {
            const error = Object.assign(new Error('socket'), { code });
            expect(isDatabaseError(error)).toBe(false);
        });
    });

    it('순환 cause에서도 멈춘다', () => {
        const a = new Error('a');
        const b = new Error('b', { cause: a });
        Object.assign(a, { cause: b });
        expect(isDatabaseError(a)).toBe(false);
    });

    it('깊이 상한(8단) 밖의 DB 에러는 찾지 않는다', () => {
        const wrap = (depth: number): Error =>
            depth === 0
                ? new Error('Failed query: x')
                : new Error(`level-${depth}`, { cause: wrap(depth - 1) });
        expect(isDatabaseError(wrap(7))).toBe(true);
        expect(isDatabaseError(wrap(8))).toBe(false);
    });

    it('드라이버 표지 없는 5자리 code는 DB 에러가 아니라 그대로 둔다(공급자 JSON 에러)', () => {
        const providerError = Object.assign(new Error('quota exceeded'), {
            code: '10001',
        });
        expect(isDatabaseError(providerError)).toBe(false);
        expect(redactDbErrorForLog(providerError)).toBe(providerError);
    });

    it('읽다가 던지는 에러는 DB 에러로 보고 고정 문자열을 돌려준다(던지지 않는다)', () => {
        const hostile = new Error('safe');
        Object.defineProperty(hostile, 'code', {
            get() {
                throw new Error(`boom ${PLANTED_TOKEN}`);
            },
        });
        const out = redactDbErrorForLog(hostile);
        expect(out).toBe('unreadable error');
        expect(String(out)).not.toContain(PLANTED_TOKEN);
    });

    it('폐기된 Proxy도 던지지 않는다', () => {
        const { proxy, revoke } = Proxy.revocable({}, {});
        revoke();
        expect(redactDbErrorForLog(proxy)).toBe('unreadable error');
    });

    it('redactedErrorMessage: 비DB 에러는 message, DB 에러는 이름과 코드, 그 밖의 값은 문자열', () => {
        expect(redactedErrorMessage(new Error('FMP 429'))).toBe('FMP 429');
        expect(redactedErrorMessage('plain')).toBe('plain');
        expect(
            redactedErrorMessage(
                new DrizzleQueryError('select 1 where x = $1', [PLANTED_TOKEN])
            )
        ).toBe('Error code=none');
        const hostile = Object.create(null) as object;
        expect(redactedErrorMessage(hostile)).toBe('unreadable error');
    });
});
