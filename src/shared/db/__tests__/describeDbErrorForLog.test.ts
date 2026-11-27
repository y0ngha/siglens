import { describe, expect, it } from 'vitest';
import { describeDbErrorForLog } from '@/shared/db/describeDbErrorForLog';

describe('describeDbErrorForLog', () => {
    it('이름과 cause 체인의 코드만 돌려주고 메시지·파라미터는 버린다', () => {
        const driver = Object.assign(
            new Error('column "landing_site" does not exist'),
            { name: 'PostgresError', code: '42703' }
        );
        const wrapped = new Error(
            'Failed query: insert … params: hash-secret,UA-secret,/path-secret',
            { cause: driver }
        );
        const text = describeDbErrorForLog(wrapped);
        expect(text).toBe('Error code=42703');
        expect(text).not.toContain('secret');
    });

    it('코드가 없으면 none이다', () => {
        expect(describeDbErrorForLog(new TypeError('x'))).toBe(
            'TypeError code=none'
        );
    });

    it('Error가 아닌 값도 던지지 않는다', () => {
        expect(describeDbErrorForLog('boom with secret')).toBe(
            'string code=none'
        );
    });

    it('순환 cause도 끊는다', () => {
        const a = new Error('a');
        const b = new Error('b', { cause: a });
        Object.assign(a, { cause: b });
        expect(describeDbErrorForLog(a)).toBe('Error code=none');
    });

    it('깊이 상한(8단) 안의 코드는 찾고, 그보다 깊은 코드는 찾지 않는다', () => {
        const chain = (depth: number): Error =>
            depth === 0
                ? Object.assign(new Error('leaf'), { code: '40001' })
                : new Error(`level-${depth}`, { cause: chain(depth - 1) });
        // 코드가 든 에러까지 깊이 7(0부터 세어 8번째)이면 찾는다.
        expect(describeDbErrorForLog(chain(7))).toBe('Error code=40001');
        // 깊이 8이면 상한 밖이라 none이다.
        expect(describeDbErrorForLog(chain(8))).toBe('Error code=none');
    });
});
