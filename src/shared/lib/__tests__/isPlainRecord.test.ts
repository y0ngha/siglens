import { describe, expect, it } from 'vitest';
import { isPlainRecord } from '@/shared/lib/isPlainRecord';

describe('isPlainRecord', () => {
    describe('객체 입력', () => {
        it('일반 객체는 true', () => {
            expect(isPlainRecord({ a: 1 })).toBe(true);
            expect(isPlainRecord({})).toBe(true);
        });

        it('배열은 false', () => {
            expect(isPlainRecord([])).toBe(false);
            expect(isPlainRecord([1])).toBe(false);
        });
    });

    describe('객체가 아닌 입력', () => {
        it('null은 false', () => {
            expect(isPlainRecord(null)).toBe(false);
        });

        it('원시값은 false', () => {
            expect(isPlainRecord(1)).toBe(false);
            expect(isPlainRecord('a')).toBe(false);
            expect(isPlainRecord(undefined)).toBe(false);
        });
    });
});
