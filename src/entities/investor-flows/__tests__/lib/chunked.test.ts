import { chunked } from '../../lib/chunked';

describe('chunked', () => {
    it('splits into size-limited chunks in order', () => {
        expect(chunked([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    });

    it('returns no chunks for empty input', () => {
        expect(chunked([], 3)).toEqual([]);
    });

    it('returns one chunk when the input fits', () => {
        expect(chunked([1, 2], 5)).toEqual([[1, 2]]);
    });
});
