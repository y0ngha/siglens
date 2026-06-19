import { describe, it, expect } from 'vitest';
import { chunkDateRange } from '../chunkDateRange';

describe('chunkDateRange guard', () => {
    it('throws RangeError when chunkDays < 1', () => {
        expect(() => chunkDateRange('2026-01-01', '2026-01-10', 0)).toThrow(
            RangeError
        );
    });
});

describe('chunkDateRange', () => {
    it('splits a range into [from,to] chunks of at most chunkDays', () => {
        const chunks = chunkDateRange('2026-01-01', '2026-04-01', 30);
        expect(chunks[0]).toEqual({ from: '2026-01-01', to: '2026-01-31' });
        // last chunk is clamped to the overall end
        expect(chunks.at(-1)?.to).toBe('2026-04-01');
    });

    it('never lets a chunk end after the overall end', () => {
        const chunks = chunkDateRange('2026-01-01', '2026-01-10', 30);
        expect(chunks).toEqual([{ from: '2026-01-01', to: '2026-01-10' }]);
    });

    it('produces contiguous, non-overlapping chunks', () => {
        const chunks = chunkDateRange('2026-01-01', '2026-03-15', 30);
        for (let i = 1; i < chunks.length; i++) {
            // next chunk starts the day after the previous chunk ends
            const prevEnd = chunks[i - 1].to;
            const [y, m, d] = prevEnd.split('-').map(Number);
            const next = new Date(Date.UTC(y, m - 1, d + 1));
            const expected = `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}-${String(next.getUTCDate()).padStart(2, '0')}`;
            expect(chunks[i].from).toBe(expected);
        }
    });
});
