import { describe, expect, it } from 'vitest';
import { readCachedSuggestions } from '../readCachedSuggestions';

describe('readCachedSuggestions', () => {
    it('returns hit with the items when 3 or more strings are cached', () => {
        expect(readCachedSuggestions(['a', 'b', 'c'])).toEqual({
            kind: 'hit',
            items: ['a', 'b', 'c'],
        });
    });

    it('treats an empty array as the negative marker', () => {
        expect(readCachedSuggestions([])).toEqual({ kind: 'negative' });
    });

    it('treats a list shorter than 3 as a miss', () => {
        expect(readCachedSuggestions(['a', 'b'])).toEqual({ kind: 'miss' });
    });

    it('treats null as a miss', () => {
        expect(readCachedSuggestions(null)).toEqual({ kind: 'miss' });
    });

    it('treats a non-array value as a miss', () => {
        expect(readCachedSuggestions('abc')).toEqual({ kind: 'miss' });
    });

    it('treats an array containing non-strings as a miss', () => {
        expect(readCachedSuggestions(['a', 'b', 3])).toEqual({ kind: 'miss' });
    });
});
