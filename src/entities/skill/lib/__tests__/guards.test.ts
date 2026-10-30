import { describe, expect, it } from 'vitest';
import { isOneOf, isRecord } from '../guards';

describe('isRecord', () => {
    describe('객체 입력', () => {
        it('일반 객체는 true', () => {
            expect(isRecord({ a: 1 })).toBe(true);
        });

        it('배열도 객체로 취급해 true', () => {
            expect(isRecord([])).toBe(true);
        });
    });

    describe('객체가 아닌 입력', () => {
        it('null은 false', () => {
            expect(isRecord(null)).toBe(false);
        });

        it('원시값은 false', () => {
            expect(isRecord('x')).toBe(false);
            expect(isRecord(undefined)).toBe(false);
        });
    });
});

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
