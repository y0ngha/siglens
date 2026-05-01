import {
    generateNumericCode,
    generateUrlSafeToken,
    hashEmailToken,
    safeCompareTokenHashes,
} from '@/infrastructure/auth/tokenUtils';

const SHA256_HEX_LENGTH = 64;
const NUMERIC_CODE_PATTERN = /^\d+$/;
const URL_SAFE_BASE64_PATTERN = /^[A-Za-z0-9_-]+$/;

describe('generateUrlSafeToken', () => {
    it('returns a base64url-encoded string with no padding', () => {
        const token = generateUrlSafeToken(32);
        expect(token).toMatch(URL_SAFE_BASE64_PATTERN);
    });

    it('returns different tokens on repeated calls', () => {
        const a = generateUrlSafeToken(32);
        const b = generateUrlSafeToken(32);
        expect(a).not.toBe(b);
    });

    it('produces a longer string for a larger byte length', () => {
        const short = generateUrlSafeToken(16);
        const long = generateUrlSafeToken(64);
        expect(long.length).toBeGreaterThan(short.length);
    });
});

describe('generateNumericCode', () => {
    it('returns digits-only output of the requested length', () => {
        const code = generateNumericCode(6);
        expect(code).toHaveLength(6);
        expect(code).toMatch(NUMERIC_CODE_PATTERN);
    });

    it('preserves leading zeros via left-padding', () => {
        const codes = Array.from({ length: 200 }, () => generateNumericCode(6));
        for (const code of codes) {
            expect(code).toHaveLength(6);
        }
    });

    it('returns codes within the expected numeric range', () => {
        const code = generateNumericCode(6);
        const value = Number.parseInt(code, 10);
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThan(1_000_000);
    });
});

describe('hashEmailToken', () => {
    it('returns a 64-character lowercase hex sha256 digest', () => {
        const hash = hashEmailToken('raw-token');
        expect(hash).toHaveLength(SHA256_HEX_LENGTH);
        expect(hash).toMatch(/^[0-9a-f]+$/);
    });

    it('produces the same hash for the same input', () => {
        const a = hashEmailToken('value');
        const b = hashEmailToken('value');
        expect(a).toBe(b);
    });

    it('produces different hashes for different inputs', () => {
        const a = hashEmailToken('value-a');
        const b = hashEmailToken('value-b');
        expect(a).not.toBe(b);
    });
});

describe('safeCompareTokenHashes', () => {
    it('returns true for identical sha256 hex digests', () => {
        const hash = hashEmailToken('value');
        expect(safeCompareTokenHashes(hash, hash)).toBe(true);
    });

    it('returns false for different sha256 hex digests', () => {
        const a = hashEmailToken('value-a');
        const b = hashEmailToken('value-b');
        expect(safeCompareTokenHashes(a, b)).toBe(false);
    });

    it('returns false when either input is not the expected hex length', () => {
        const valid = hashEmailToken('value');
        expect(safeCompareTokenHashes(valid, 'too-short')).toBe(false);
        expect(safeCompareTokenHashes('too-short', valid)).toBe(false);
        expect(safeCompareTokenHashes('', '')).toBe(false);
    });

    it('returns false when either input has the expected length but is not hex', () => {
        const valid = hashEmailToken('value');
        const malformed = 'z'.repeat(SHA256_HEX_LENGTH);

        expect(safeCompareTokenHashes(valid, malformed)).toBe(false);
        expect(safeCompareTokenHashes(malformed, valid)).toBe(false);
    });
});
