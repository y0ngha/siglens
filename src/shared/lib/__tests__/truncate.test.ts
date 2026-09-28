import { describe, expect, it } from 'vitest';
import { truncateWithEllipsis } from '../truncate';

describe('truncateWithEllipsis', () => {
    it('returns the text unchanged when it fits', () => {
        expect(truncateWithEllipsis('abc', 3)).toBe('abc');
        expect(truncateWithEllipsis('', 3)).toBe('');
    });

    it('cuts to max - 1 code points and appends an ellipsis', () => {
        expect(truncateWithEllipsis('abcdef', 4)).toBe('abc…');
    });

    it('never splits a surrogate pair (emoji)', () => {
        // '😀' is 2 UTF-16 units; a unit-based slice(0, 3) would leave a lone surrogate.
        const result = truncateWithEllipsis('ab😀cd', 4);
        expect(result).toBe('ab😀…');
        expect(result.isWellFormed()).toBe(true);
    });

    it('counts length in code points, not UTF-16 units', () => {
        // 3 code points / 6 units — fits in max 3.
        expect(truncateWithEllipsis('😀😀😀', 3)).toBe('😀😀😀');
    });

    it('trimEnd strips trailing whitespace before the ellipsis', () => {
        expect(truncateWithEllipsis('ab   cdef', 5, { trimEnd: true })).toBe(
            'ab…'
        );
        expect(truncateWithEllipsis('ab   cdef', 5)).toBe('ab  …');
    });
});
