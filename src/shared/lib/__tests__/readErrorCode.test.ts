import { describe, expect, it } from 'vitest';
import { readErrorCode } from '@/shared/lib/readErrorCode';

describe('readErrorCode', () => {
    describe('code가 있는 입력', () => {
        it('cause.code를 읽는다', () => {
            expect(readErrorCode({ cause: { code: '23505' } })).toBe('23505');
        });

        it('cause.code가 없으면 최상위 code를 읽는다', () => {
            expect(readErrorCode({ code: 'ECONNRESET' })).toBe('ECONNRESET');
        });

        it('둘 다 있으면 cause.code가 우선한다', () => {
            expect(
                readErrorCode({ code: 'ECONNRESET', cause: { code: '23505' } })
            ).toBe('23505');
        });
    });

    describe('code를 읽을 수 없는 입력', () => {
        it('문자열이 아닌 code는 없는 것으로 본다', () => {
            expect(readErrorCode({ code: 42 })).toBeUndefined();
        });

        it('객체가 아닌 값은 undefined', () => {
            expect(readErrorCode(null)).toBeUndefined();
            expect(readErrorCode('boom')).toBeUndefined();
        });
    });
});
