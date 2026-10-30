import { describe, it, expect } from 'vitest';
import {
    detectedAmong,
    parseProjected,
} from '@/entities/seo-snapshot/lib/projectedJson';

describe('parseProjected', () => {
    it('parses a JSON string the driver returned instead of a value', () => {
        expect(parseProjected('["a","b"]')).toEqual(['a', 'b']);
    });

    it('returns null for a string that is not JSON', () => {
        expect(parseProjected('not json')).toBeNull();
    });

    it('passes a non-string value through unchanged', () => {
        const value = ['a'];
        expect(parseProjected(value)).toBe(value);
        expect(parseProjected(null)).toBeNull();
    });
});

describe('detectedAmong', () => {
    it('returns detected names in the requested order, not the stored order', () => {
        expect(detectedAmong(['x', 'y', 'z'], ['z', 'x'])).toEqual(['x', 'z']);
    });

    it('ignores non-string entries and names that were not requested', () => {
        expect(detectedAmong(['x'], [1, null, 'x', 'other'])).toEqual(['x']);
    });

    it.each([null, undefined, 'x', { 0: 'x' }])(
        'returns an empty array for non-array %s',
        projected => {
            expect(detectedAmong(['x'], projected)).toEqual([]);
        }
    );
});
