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

/**
 * 콘텐츠 게이트 — 2026-08-24 프로덕션 전수 조사에서 유니버스 431종 중 14종이
 * 봉이 전혀 없어 차트 페이지가 고유 330자 껍데기인 채 `index, follow`로
 * sitemap에 실려 있었다(대부분 상장폐지 티커). 멤버십 화이트리스트가
 * "지금 이 페이지에 콘텐츠가 있는가"를 답하지 못하는 데서 온 결함이다.
 */
describe('evaluateSymbolIndexability — hasPriceData 게이트', () => {
    it('봉이 없으면 인기 종목이라도 차단한다', () => {
        expect(
            evaluateSymbolIndexability({
                symbol: 'AAPL',
                assetInfo: asset('AAPL'),
                degraded: false,
                hasPriceData: false,
            })
        ).toEqual({ indexable: false, reason: 'no-price-data' });
    });

    it('봉이 없으면 저장된 스냅샷이 있어도 차단한다 (죽은 티커의 낡은 서술)', () => {
        expect(
            evaluateSymbolIndexability({
                symbol: 'AAPL',
                assetInfo: asset('AAPL'),
                degraded: true,
                hasSnapshot: true,
                hasPriceData: false,
            })
        ).toEqual({ indexable: false, reason: 'no-price-data' });
    });

    it('봉이 있으면 기존 판정을 그대로 따른다', () => {
        expect(
            evaluateSymbolIndexability({
                symbol: 'AAPL',
                assetInfo: asset('AAPL'),
                degraded: false,
                hasPriceData: true,
            })
        ).toEqual({ indexable: true, reason: 'popular' });
    });

    /**
     * 인프라 장애로 봉 조회가 **실패**한 경우와 조회 결과 봉이 **없는** 경우는
     * 다르다. 전자를 noindex로 밀면 FMP 장애 한 번이 전 종목 색인 해제로 번진다.
     * 호출부(`[symbol]/page.tsx`)가 실패를 `undefined`로 매핑하고, 여기서는
     * `undefined`가 기존 판정을 건드리지 않아야 한다.
     */
    it('undefined면 게이트가 적용되지 않는다 (조회 실패 = 판단 보류)', () => {
        expect(
            evaluateSymbolIndexability({
                symbol: 'AAPL',
                assetInfo: asset('AAPL'),
                degraded: false,
                hasPriceData: undefined,
            })
        ).toEqual({ indexable: true, reason: 'popular' });
    });

    it('심볼 형상·assetInfo 가드가 콘텐츠 게이트보다 먼저다', () => {
        expect(
            evaluateSymbolIndexability({
                symbol: '!!!',
                assetInfo: null,
                degraded: false,
                hasPriceData: false,
            })
        ).toEqual({ indexable: false, reason: 'invalid-symbol' });
        expect(
            evaluateSymbolIndexability({
                symbol: 'ZZZQ',
                assetInfo: null,
                degraded: false,
                hasPriceData: false,
            })
        ).toEqual({ indexable: false, reason: 'asset-missing' });
    });
});
