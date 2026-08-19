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
                assetInfo: null,
                degraded: false,
            })
        ).toEqual({ indexable: false, reason: 'invalid-symbol' });
    });

    it('blocks missing assetInfo', () => {
        expect(
            evaluateSymbolIndexability({
                symbol: 'ZZZQ',
                assetInfo: null,
                degraded: false,
            })
        ).toEqual({ indexable: false, reason: 'asset-missing' });
    });

    it('blocks degraded fallback even for popular tickers', () => {
        expect(
            evaluateSymbolIndexability({
                symbol: 'AAPL',
                assetInfo: asset('AAPL'),
                degraded: true,
            })
        ).toEqual({ indexable: false, reason: 'degraded' });
    });

    it('allows popular equity tickers', () => {
        expect(
            evaluateSymbolIndexability({
                symbol: 'aapl',
                assetInfo: asset('AAPL'),
                degraded: false,
            })
        ).toEqual({ indexable: true, reason: 'popular' });
    });

    it('allows curated crypto tickers', () => {
        expect(
            evaluateSymbolIndexability({
                symbol: 'btcusd',
                assetInfo: asset('BTCUSD', { marketProfile: 'crypto' }),
                degraded: false,
            })
        ).toEqual({ indexable: true, reason: 'curated-crypto' });
    });

    it('allows degraded whitelisted symbols with a stored snapshot', () => {
        expect(
            evaluateSymbolIndexability({
                symbol: 'AAPL',
                assetInfo: asset('AAPL'),
                degraded: true,
                hasSnapshot: true,
            })
        ).toEqual({ indexable: true, reason: 'degraded-with-snapshot' });
    });

    it('blocks degraded whitelisted symbols without a stored snapshot', () => {
        expect(
            evaluateSymbolIndexability({
                symbol: 'AAPL',
                assetInfo: asset('AAPL'),
                degraded: true,
                hasSnapshot: false,
            })
        ).toEqual({ indexable: false, reason: 'degraded' });
    });

    it('blocks degraded non-whitelisted symbols even with a stored snapshot', () => {
        expect(
            evaluateSymbolIndexability({
                symbol: 'ZZZOF',
                assetInfo: asset('ZZZOF'),
                degraded: true,
                hasSnapshot: true,
            })
        ).toEqual({ indexable: false, reason: 'degraded' });
    });

    it('blocks degraded symbols when hasSnapshot is omitted (back-compat)', () => {
        expect(
            evaluateSymbolIndexability({
                symbol: 'AAPL',
                assetInfo: asset('AAPL'),
                degraded: true,
            })
        ).toEqual({ indexable: false, reason: 'degraded' });
    });

    it('blocks unapproved longtail tickers by default', () => {
        expect(
            evaluateSymbolIndexability({
                symbol: '0NEUSD',
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
                assetInfo: asset('ZZZOF'),
                degraded: false,
            })
        ).toEqual({
            indexable: false,
            reason: 'longtail-default-blocked',
        });
    });
});

describe('로케일 게이트', () => {
    const popular = {
        symbol: 'AAPL',
        assetInfo: { symbol: 'AAPL', name: 'Apple Inc.', fmpSymbol: 'AAPL' },
        degraded: false,
    } as const;

    it('기본 로케일은 기존과 동일하게 판정된다', () => {
        expect(
            evaluateSymbolIndexability({ ...popular, locale: 'ko' })
        ).toEqual({ indexable: true, reason: 'popular' });
    });

    /**
     * 본문(AI 분석 산문)이 아직 한국어로만 생성된다. 영어 껍데기 안에 한국어
     * 본문이 담긴 URL이 색인되면 2026-07 thin-content 노출 붕괴가 재현된다.
     */
    it.each(['en', 'ja', 'zh'] as const)(
        '%s는 인기 티커여도 색인하지 않는다',
        locale => {
            expect(evaluateSymbolIndexability({ ...popular, locale })).toEqual({
                indexable: false,
                reason: 'locale-not-ready',
            });
        }
    );

    /** 로케일 게이트는 화이트리스트보다 **먼저** 판정돼야 한다. */
    it('locale 미지정은 기본 로케일로 본다(기존 호출부 호환)', () => {
        expect(evaluateSymbolIndexability(popular)).toEqual({
            indexable: true,
            reason: 'popular',
        });
    });
});
