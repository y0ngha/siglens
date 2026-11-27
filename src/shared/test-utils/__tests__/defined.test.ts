import { describe, expect, it } from 'vitest';
import { defined } from '../defined';

describe('defined', () => {
    it('returns the value it was given', () => {
        const value = { id: 1 };
        expect(defined(value)).toBe(value);
    });

    it('keeps falsy values that are not null or undefined', () => {
        expect(defined(0)).toBe(0);
        expect(defined('')).toBe('');
        expect(defined(false)).toBe(false);
    });

    it('throws a named error on null', () => {
        expect(() => defined(null)).toThrow('expected value to be defined');
    });

    it('throws a named error on undefined', () => {
        expect(() => defined(undefined)).toThrow(
            'expected value to be defined'
        );
    });

    it('names what is missing when a label is given', () => {
        expect(() => defined(undefined, 'the first call')).toThrow(
            'expected the first call to be defined'
        );
    });
});
