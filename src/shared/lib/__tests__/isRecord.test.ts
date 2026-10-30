import { describe, expect, it } from 'vitest';
import { isRecord } from '@/shared/lib/isRecord';

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
            expect(isRecord(1)).toBe(false);
        });
    });
});
