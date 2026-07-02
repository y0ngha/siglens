import { generateShareId } from '@/entities/shared-analysis/lib/generateShareId';

const URL_SAFE = /^[A-Za-z0-9_-]+$/;

describe('generateShareId', () => {
    it('returns a url-safe base64url token', () => {
        expect(generateShareId()).toMatch(URL_SAFE);
    });
    it('returns a token of meaningful length (>= 16 chars)', () => {
        expect(generateShareId().length).toBeGreaterThanOrEqual(16);
    });
    it('returns different tokens on repeated calls', () => {
        expect(generateShareId()).not.toBe(generateShareId());
    });
});
