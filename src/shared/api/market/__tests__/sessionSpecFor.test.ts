import { describe, it, expect } from 'vitest';
import { sessionSpecFor } from '../sessionSpecFor';
import { US_EQUITY_SESSION, CRYPTO_SESSION } from '@y0ngha/siglens-core';

describe('sessionSpecFor', () => {
    it('maps crypto → always-open session', () => {
        expect(sessionSpecFor('crypto')).toBe(CRYPTO_SESSION);
    });
    it('maps us-equity → ET session', () => {
        expect(sessionSpecFor('us-equity')).toBe(US_EQUITY_SESSION);
    });
});
