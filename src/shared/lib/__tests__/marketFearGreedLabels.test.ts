import {
    MARKET_FACTOR_DESCRIPTION,
    MARKET_FACTOR_LABEL,
    formatMarketFactorRaw,
} from '@/shared/lib/marketFearGreedLabels';

const FACTOR_KEYS = [
    'momentum',
    'volatility',
    'safe_haven',
    'junk_bond',
    'breadth',
] as const;

describe('MARKET_FACTOR_LABEL', () => {
    it('provides a Korean label for every factor key in the US index', () => {
        expect(MARKET_FACTOR_LABEL.us.momentum).toBe('시장 모멘텀');
        expect(MARKET_FACTOR_LABEL.us.volatility).toBe('시장 변동성');
        expect(MARKET_FACTOR_LABEL.us.safe_haven).toBe('안전자산 선호');
        expect(MARKET_FACTOR_LABEL.us.junk_bond).toBe('하이일드 수요');
        expect(MARKET_FACTOR_LABEL.us.breadth).toBe('시장 폭');
    });

    it('renames the credit factor for the KR index', () => {
        // 국내에는 유동성 있는 하이일드 채권이 없어 `junk_bond` 슬롯을 회사채−국고채
        // 스프레드로 채웠다 — `하이일드 수요`라고 부르면 화면이 사실과 다른 말을 한다.
        expect(MARKET_FACTOR_LABEL.kr.junk_bond).toBe('신용 스프레드 수요');
        expect(MARKET_FACTOR_LABEL.kr.junk_bond).not.toBe(
            MARKET_FACTOR_LABEL.us.junk_bond
        );
    });

    it('covers every factor key in both markets', () => {
        for (const market of ['us', 'kr'] as const) {
            for (const key of FACTOR_KEYS) {
                expect(MARKET_FACTOR_LABEL[market][key].length).toBeGreaterThan(
                    0
                );
            }
        }
    });
});

describe('MARKET_FACTOR_DESCRIPTION', () => {
    it('provides a non-empty Korean description for every factor key', () => {
        for (const market of ['us', 'kr'] as const) {
            for (const key of FACTOR_KEYS) {
                expect(
                    MARKET_FACTOR_DESCRIPTION[market][key].length
                ).toBeGreaterThan(0);
            }
        }
    });

    it('names the actual KR inputs, not the US ones', () => {
        // 한국 변동성 요인은 VKOSPI가 아니라 코스피 실현변동성이다. 그 사실이
        // 설명에서 빠지면 화면이 있지도 않은 지수를 쓰는 것처럼 읽힌다.
        expect(MARKET_FACTOR_DESCRIPTION.kr.volatility).toContain('실현변동성');
        expect(MARKET_FACTOR_DESCRIPTION.kr.volatility).not.toContain('VIX');
        expect(MARKET_FACTOR_DESCRIPTION.kr.momentum).not.toContain('S&P');
        expect(MARKET_FACTOR_DESCRIPTION.kr.junk_bond).toContain('국고채');
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
