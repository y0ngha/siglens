import { describe, expect, it } from 'vitest';
import { isOneOf } from '../guards';

describe('isOneOf', () => {
    const LIST = ['a', 'b'] as const;

    describe('멤버 판정', () => {
        it('멤버면 true', () => {
            expect(isOneOf(LIST, 'b')).toBe(true);
        });

        it('멤버가 아니면 false', () => {
            expect(isOneOf(LIST, 'c')).toBe(false);
        });

        it('문자열이 아닌 값은 false', () => {
            expect(isOneOf(LIST, 1)).toBe(false);
            expect(isOneOf(LIST, undefined)).toBe(false);
        });
    });
});
