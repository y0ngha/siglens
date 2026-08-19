import { MARKET_FEAR_GREED_SERIES_KEYS } from '@y0ngha/siglens-core';
import {
    KOSPI_INDEX_SYMBOL,
    MARKET_FEAR_GREED_KR_LOOKBACK_DAYS,
    MARKET_FEAR_GREED_KR_SERIES,
    MARKET_FEAR_GREED_KR_SYMBOLS,
} from '../lib/marketFearGreedKrSymbols';
import { MARKET_FEAR_GREED_SYMBOLS } from '../lib/marketFearGreedSymbols';

describe('KR market fear & greed symbols', () => {
    it('maps every core series key except vix', () => {
        // `vix`만 티커가 없다 — VKOSPI를 무료로 받을 경로가 없어 코스피 종가에서
        // 실현변동성을 파생한다.
        const mapped = Object.keys(MARKET_FEAR_GREED_KR_SYMBOLS).toSorted();
        const expected = MARKET_FEAR_GREED_SERIES_KEYS.filter(
            k => k !== 'vix'
        ).toSorted();
        expect(mapped).toEqual(expected);
    });

    it('excludes vix from the fetch list', () => {
        expect(MARKET_FEAR_GREED_KR_SERIES.map(s => s.key)).not.toContain(
            'vix'
        );
        expect(MARKET_FEAR_GREED_KR_SERIES).toHaveLength(
            MARKET_FEAR_GREED_SERIES_KEYS.length - 1
        );
    });

    it('gives every leg its own ticker', () => {
        // 같은 시리즈를 두 키에 넣으면 `safe_haven`과 `junk_bond`가 같은 다리를
        // 공유해 두 요인의 독립성이 떨어진다.
        const tickers = Object.values(MARKET_FEAR_GREED_KR_SYMBOLS);
        expect(new Set(tickers).size).toBe(tickers.length);
    });

    it('uses KRX-listed tickers, never the US ones', () => {
        for (const ticker of Object.values(MARKET_FEAR_GREED_KR_SYMBOLS)) {
            expect(ticker).toMatch(/^\d{6}\.(KS|KQ)$/);
        }
        expect(Object.values(MARKET_FEAR_GREED_KR_SYMBOLS)).not.toContain(
            MARKET_FEAR_GREED_SYMBOLS.sp500
        );
    });

    it('derives volatility from the index, not the ETF', () => {
        // ETF 가격은 분배금 락과 괴리율이 섞여 변동성이 소폭 부풀어 오른다.
        expect(KOSPI_INDEX_SYMBOL).toBe('^KS11');
        expect(Object.values(MARKET_FEAR_GREED_KR_SYMBOLS)).not.toContain(
            KOSPI_INDEX_SYMBOL
        );
    });

    it('requests enough history for a normal-confidence reading', () => {
        // 모멘텀 창 125세션 + confidence normal에 필요한 60세션 + "1년 전" 비교.
        expect(MARKET_FEAR_GREED_KR_LOOKBACK_DAYS).toBeGreaterThanOrEqual(1095);
    });
});
