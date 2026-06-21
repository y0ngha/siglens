import { describe, it, expect } from 'vitest';
import {
    getDescriptor,
    marketProfileOf,
    DEFAULT_MARKET_PROFILE,
} from '../registry';

describe('market profile registry', () => {
    describe('getDescriptor', () => {
        it('returns the us-equity descriptor', () => {
            const d = getDescriptor('us-equity');
            expect(d.assetClass).toBe('equity');
            expect(d.exchangeWhitelist).not.toBeNull();
            expect(d.tabs).toContain('fundamental');
        });

        it('returns the crypto descriptor with crypto-specific policy', () => {
            const d = getDescriptor('crypto');
            expect(d.assetClass).toBe('crypto');
            expect(d.exchangeWhitelist).toBeNull();
            expect(d.searchSource).toBe('crypto-store');
            expect(d.tabs).not.toContain('fundamental');
            expect(d.tabs).not.toContain('options');
            expect(d.allowedTimeframes).not.toContain('4Hour');
            expect(d.priceFormat.precision).toEqual({
                kind: 'dynamic-by-magnitude',
            });
        });
    });

    describe('DEFAULT_MARKET_PROFILE', () => {
        it('is us-equity', () => {
            expect(DEFAULT_MARKET_PROFILE).toBe('us-equity');
        });
    });

    describe('marketProfileOf', () => {
        it('defaults to us-equity when marketProfile is absent', () => {
            expect(marketProfileOf({ symbol: 'AAPL', name: 'Apple' })).toBe(
                'us-equity'
            );
        });

        it('returns the explicit marketProfile when present', () => {
            expect(
                marketProfileOf({
                    symbol: 'BTCUSD',
                    name: 'Bitcoin',
                    marketProfile: 'crypto',
                })
            ).toBe('crypto');
        });
    });
});
