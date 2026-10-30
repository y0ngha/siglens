import { describe, expect, it } from 'vitest';
import { isRecord } from '../../lib/isRecord';

describe('isRecord', () => {
    it('일반 객체는 참', () => {
        expect(isRecord({ a: 1 })).toBe(true);
        expect(isRecord({})).toBe(true);
    });

    it('배열은 거짓', () => {
        expect(isRecord([])).toBe(false);
        expect(isRecord([1])).toBe(false);
    });

    it('null은 거짓', () => {
        expect(isRecord(null)).toBe(false);
    });

    it('원시값은 거짓', () => {
        expect(isRecord(1)).toBe(false);
        expect(isRecord('a')).toBe(false);
        expect(isRecord(undefined)).toBe(false);
    });
});
