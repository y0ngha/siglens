import {
    MARKET_FACTOR_DESCRIPTION,
    MARKET_FACTOR_LABEL,
    formatMarketFactorRaw,
} from '@/shared/lib/marketFearGreedLabels';

describe('MARKET_FACTOR_LABEL', () => {
    it('provides a Korean label for every factor key', () => {
        expect(MARKET_FACTOR_LABEL.momentum).toBe('시장 모멘텀');
        expect(MARKET_FACTOR_LABEL.volatility).toBe('시장 변동성');
        expect(MARKET_FACTOR_LABEL.safe_haven).toBe('안전자산 선호');
        expect(MARKET_FACTOR_LABEL.junk_bond).toBe('하이일드 수요');
        expect(MARKET_FACTOR_LABEL.breadth).toBe('시장 폭');
    });
});

describe('MARKET_FACTOR_DESCRIPTION', () => {
    it('provides a non-empty Korean description for every factor key', () => {
        for (const key of [
            'momentum',
            'volatility',
            'safe_haven',
            'junk_bond',
            'breadth',
        ] as const) {
            expect(MARKET_FACTOR_DESCRIPTION[key].length).toBeGreaterThan(0);
        }
    });
});

describe('formatMarketFactorRaw', () => {
    it('formats a positive ratio as a signed 2dp percent', () => {
        expect(formatMarketFactorRaw(0.0512)).toBe('+5.12%');
    });

    it('formats a negative ratio as a signed 2dp percent', () => {
        expect(formatMarketFactorRaw(-0.0314)).toBe('-3.14%');
    });

    it('formats zero with an explicit leading sign', () => {
        expect(formatMarketFactorRaw(0)).toBe('+0.00%');
    });

    it('rounds to exactly two fraction digits', () => {
        expect(formatMarketFactorRaw(0.012345)).toBe('+1.23%');
    });
});
