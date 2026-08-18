import { describe, it, expect } from 'vitest';
import {
    getDescriptor,
    marketProfileOf,
    currencyForSymbol,
    DEFAULT_MARKET_PROFILE,
} from '../registry';

describe('market profile registry', () => {
    describe('getDescriptor', () => {
        it('returns the us-equity descriptor', () => {
            const d = getDescriptor('us-equity');
            expect(d.assetClass).toBe('equity');
            expect(d.exchangeWhitelist).not.toBeNull();
            expect(d.tabs).toEqual([
                'chart',
                'news',
                'fundamental',
                'financials',
                'congress',
                'options',
                'fear-greed',
                'overall',
                'position',
            ]);
            expect(d.allowedTimeframes).toEqual([
                '5Min',
                '15Min',
                '30Min',
                '1Hour',
                '4Hour',
                '1Day',
            ]);
            expect(d.defaultTimeframe).toBe('1Day');
            expect(d.priceFormat.precision).toEqual({
                kind: 'fixed',
                digits: 2,
            });
        });

        it('returns the crypto descriptor with crypto-specific policy', () => {
            const d = getDescriptor('crypto');
            expect(d.assetClass).toBe('crypto');
            expect(d.exchangeWhitelist).toBeNull();
            expect(d.searchSource).toBe('crypto-store');
            expect(d.tabs).toEqual([
                'chart',
                'news',
                'fear-greed',
                'overall',
                'position',
            ]);
            expect(d.allowedTimeframes).toEqual(['5Min', '1Hour', '1Day']);
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

    describe('currencyForSymbol', () => {
        // formatCompactCurrency/FutureDirectionCard/EventCalendar가 각자
        // `isKrEquitySymbol(symbol) ? 'KRW' : 'USD'`로 재구현했던 판정을 여기 한 곳으로
        // 모았다 — 세 자산군(KOSPI/KOSDAQ, 미국, 크립토) 전부를 명시적으로 고정해
        // 크립토의 USD 결과가 우연이 아니라 의도임을 못박는다.
        it('KOSPI 종목은 KRW다', () => {
            expect(currencyForSymbol('005930.KS')).toBe('KRW');
        });

        it('KOSDAQ 종목도 KRW다', () => {
            expect(currencyForSymbol('247540.KQ')).toBe('KRW');
        });

        it('미국 종목은 USD다', () => {
            expect(currencyForSymbol('AAPL')).toBe('USD');
        });

        it('크립토는 USD다 — us-equity 폴백과 우연히 일치하는 것이 아니라 CRYPTO_DESCRIPTOR도 USD라서다', () => {
            expect(currencyForSymbol('BTCUSD')).toBe('USD');
            expect(getDescriptor('crypto').priceFormat.currency).toBe('USD');
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
