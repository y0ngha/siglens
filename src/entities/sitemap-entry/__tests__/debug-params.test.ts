/**
 * NOTE: This file was used as a temporary debug helper during development
 * to verify drizzle param ordering for DrizzleCryptoLongTailSource.
 * The actual DB method tests live in cryptoLongTailSource.test.ts.
 * Remove this file when convenient.
 */
import { describe, it, expect } from 'vitest';
import { CRYPTO_LONGTAIL_CAP } from '../lib/cryptoLongTailSource';

describe('crypto longtail cap (debug-params stub)', () => {
    it('CRYPTO_LONGTAIL_CAP is a positive integer', () => {
        expect(Number.isInteger(CRYPTO_LONGTAIL_CAP)).toBe(true);
        expect(CRYPTO_LONGTAIL_CAP).toBeGreaterThan(0);
    });
});
