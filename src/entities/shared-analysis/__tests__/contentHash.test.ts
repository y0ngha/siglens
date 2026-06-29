import { contentHash } from '@/entities/shared-analysis/lib/contentHash';

const SHA256_HEX = /^[0-9a-f]{64}$/;

describe('contentHash', () => {
    it('returns a sha256 hex digest', () => {
        expect(contentHash('chart', 'AAPL', { a: 1 })).toMatch(SHA256_HEX);
    });
    it('is stable for the same inputs', () => {
        expect(contentHash('chart', 'AAPL', { a: 1 })).toBe(
            contentHash('chart', 'AAPL', { a: 1 })
        );
    });
    it('differs when kind differs', () => {
        expect(contentHash('chart', 'AAPL', { a: 1 })).not.toBe(
            contentHash('news', 'AAPL', { a: 1 })
        );
    });
    it('differs when result differs', () => {
        expect(contentHash('chart', 'AAPL', { a: 1 })).not.toBe(
            contentHash('chart', 'AAPL', { a: 2 })
        );
    });
});
