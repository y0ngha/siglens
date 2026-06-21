import { describe, it, expect } from 'vitest';
import { CRYPTO_LONGTAIL_CAP } from '../lib/cryptoLongTailSource';

describe('crypto longtail cap', () => {
    it('caps the crypto longtail universe to a sane number of URLs', () => {
        expect(CRYPTO_LONGTAIL_CAP).toBeGreaterThan(0);
        expect(CRYPTO_LONGTAIL_CAP).toBeLessThanOrEqual(2000);
    });
});
