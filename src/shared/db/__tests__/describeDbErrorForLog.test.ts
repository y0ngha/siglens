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
});
