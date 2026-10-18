import { describe, expect, it } from 'vitest';
import {
    formatAnalysisPrice,
    quotedPriceForSymbol,
} from '@/shared/lib/analysisPriceFormat';

describe('quotedPriceForSymbol', () => {
    it('rounds a KRX listing to its tick and leaves other markets alone', () => {
        // 200,000–500,000원 구간의 호가 단위는 500원이다.
        expect(quotedPriceForSymbol(205_325, '005930.KS')).toBe(205_500);
        expect(quotedPriceForSymbol(271_192.31, '247540.KQ')).toBe(271_000);
        // 1,000원 미만은 1원 단위.
        expect(quotedPriceForSymbol(987.6, '900140.KQ')).toBe(988);
        expect(quotedPriceForSymbol(205.325, 'AAPL')).toBe(205.325);
        expect(quotedPriceForSymbol(64_192.5, 'BTCUSD')).toBe(64_192.5);
    });

    it('rounds an ETF with the etp table so a valid 5-won quote survives', () => {
        // 주식 표(2만~5만원 50원 단위)로 깎으면 올바른 ETF 호가가 망가진다.
        expect(quotedPriceForSymbol(40_125, '360750.KS')).toBe(40_150);
        expect(quotedPriceForSymbol(40_125, '360750.KS', 'share')).toBe(40_150);
        expect(quotedPriceForSymbol(40_125, '360750.KS', 'etp')).toBe(40_125);
        // 2,000원 미만은 1원 단위.
        expect(quotedPriceForSymbol(1_234, '069500.KS', 'etp')).toBe(1_234);
    });

    it('ignores the table for non-KRW listings', () => {
        expect(quotedPriceForSymbol(205.325, 'AAPL', 'etp')).toBe(205.325);
    });
});

describe('formatAnalysisPrice', () => {
    it('prints a KRX price as a whole-won tick, never with decimals', () => {
        expect(formatAnalysisPrice(240_300, '005930.KS', 'ko')).toBe('240,500');
        expect(formatAnalysisPrice(56_663, '005930.KS', 'ko')).toBe('56,700');
        expect(
            formatAnalysisPrice(271_192.31, '005930.KS', 'ko', {
                trimTrailingZeros: true,
            })
        ).toBe('271,000');
    });

    it('prints an ETF price unchanged with the etp table', () => {
        expect(formatAnalysisPrice(40_125, '360750.KS', 'ko')).toBe('40,150');
        expect(
            formatAnalysisPrice(40_125, '360750.KS', 'ko', {
                krxTickTable: 'etp',
            })
        ).toBe('40,125');
        expect(
            formatAnalysisPrice(40_125, '360750.KS', 'ko', {
                trimTrailingZeros: true,
                krxTickTable: 'etp',
            })
        ).toBe('40,125');
    });

    it('keeps two decimals elsewhere, or up to two when trimming', () => {
        expect(formatAnalysisPrice(240.3, 'AAPL', 'ko')).toBe('240.30');
        expect(
            formatAnalysisPrice(240.3, 'AAPL', 'en', {
                trimTrailingZeros: true,
            })
        ).toBe('240.3');
    });
});
