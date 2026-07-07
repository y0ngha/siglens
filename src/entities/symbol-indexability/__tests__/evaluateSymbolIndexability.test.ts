import { describe, expect, it } from 'vitest';
import { evaluateSymbolIndexability } from '../lib/evaluateSymbolIndexability';
import type { AssetInfo } from '@/shared/lib/types';

function asset(symbol: string, overrides: Partial<AssetInfo> = {}): AssetInfo {
    return {
        symbol,
        name: `${symbol} Inc.`,
        ...overrides,
    } as AssetInfo;
}

describe('evaluateSymbolIndexability', () => {
    it('blocks invalid symbol shape', () => {
        expect(
            evaluateSymbolIndexability({
                symbol: '!!!',
                route: 'chart',
                assetInfo: null,
                degraded: false,
            })
        ).toEqual({ indexable: false, reason: 'invalid-symbol' });
    });

    it('blocks missing assetInfo', () => {
        expect(
            evaluateSymbolIndexability({
                symbol: 'ZZZQ',
                route: 'chart',
                assetInfo: null,
                degraded: false,
            })
        ).toEqual({ indexable: false, reason: 'asset-missing' });
    });

    it('blocks degraded fallback even for popular tickers', () => {
        expect(
            evaluateSymbolIndexability({
                symbol: 'AAPL',
                route: 'chart',
                assetInfo: asset('AAPL'),
                degraded: true,
            })
        ).toEqual({ indexable: false, reason: 'degraded' });
    });

    it('allows popular equity tickers', () => {
        expect(
            evaluateSymbolIndexability({
                symbol: 'aapl',
                route: 'chart',
                assetInfo: asset('AAPL'),
                degraded: false,
            })
        ).toEqual({ indexable: true, reason: 'popular' });
    });

    it('allows curated crypto tickers', () => {
        expect(
            evaluateSymbolIndexability({
                symbol: 'btcusd',
                route: 'chart',
                assetInfo: asset('BTCUSD', { marketProfile: 'crypto' }),
                degraded: false,
            })
        ).toEqual({ indexable: true, reason: 'curated-crypto' });
    });

    it('blocks unapproved longtail tickers by default', () => {
        expect(
            evaluateSymbolIndexability({
                symbol: '0NEUSD',
                route: 'chart',
                assetInfo: asset('0NEUSD', { marketProfile: 'crypto' }),
                degraded: false,
            })
        ).toEqual({
            indexable: false,
            reason: 'longtail-default-blocked',
        });
    });

    it('blocks obscure equity-shaped longtail tickers by default', () => {
        expect(
            evaluateSymbolIndexability({
                symbol: 'ZZZOF',
                route: 'chart',
                assetInfo: asset('ZZZOF'),
                degraded: false,
            })
        ).toEqual({
            indexable: false,
            reason: 'longtail-default-blocked',
        });
    });
});
