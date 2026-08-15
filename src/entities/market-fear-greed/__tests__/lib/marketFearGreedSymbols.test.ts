import { describe, it, expect } from 'vitest';
import { MARKET_FEAR_GREED_SERIES_KEYS } from '@y0ngha/siglens-core';
import {
    MARKET_FEAR_GREED_SERIES,
    MARKET_FEAR_GREED_SYMBOLS,
} from '../../lib/marketFearGreedSymbols';

describe('MARKET_FEAR_GREED_SYMBOLS', () => {
    // 각 키를 실제 티커로 못박는다 — 이 매핑이 이 모듈의 존재 이유라, 두 키의
    // 값을 바꿔치기해도(예: highYield ↔ investmentGrade) 타입은 여전히
    // `Record<MarketFearGreedSeriesKey, string>`을 만족해 컴파일이 통과한다.
    // highYield(HYG)/investmentGrade(LQD)가 전치되면 junk_bond 팩터가 계산하는
    // "고위험-고신용 스프레드"의 부호가 뒤집혀, 시장이 위험 선호(risk-on)일 때
    // 오히려 공포로 읽는 등 조용히 반대로 나온다 — 이 테스트가 그걸 막는다.
    it('각 semantic key가 의도한 FMP 티커로 고정되어 있다', () => {
        expect(MARKET_FEAR_GREED_SYMBOLS).toEqual({
            sp500: 'SPY',
            vix: '^VIX',
            longTreasury: 'TLT',
            highYield: 'HYG',
            investmentGrade: 'LQD',
            equalWeight: 'RSP',
        });
    });

    it('core의 모든 MarketFearGreedSeriesKey에 티커가 매핑되어 있다', () => {
        MARKET_FEAR_GREED_SERIES_KEYS.forEach(key => {
            const symbol = MARKET_FEAR_GREED_SYMBOLS[key];
            expect(typeof symbol).toBe('string');
            expect(symbol.length).toBeGreaterThan(0);
        });
    });

    it('티커 값이 서로 중복되지 않는다', () => {
        const tickers = Object.values(MARKET_FEAR_GREED_SYMBOLS);
        expect(new Set(tickers).size).toBe(tickers.length);
    });
});

describe('MARKET_FEAR_GREED_SERIES', () => {
    it('core 키 순서대로 각 키에 대해 하나씩만 존재한다', () => {
        expect(MARKET_FEAR_GREED_SERIES.map(entry => entry.key)).toEqual(
            MARKET_FEAR_GREED_SERIES_KEYS
        );
    });

    it('각 항목의 symbol이 MARKET_FEAR_GREED_SYMBOLS의 매핑과 일치한다', () => {
        MARKET_FEAR_GREED_SERIES.forEach(({ key, symbol }) => {
            expect(symbol).toBe(MARKET_FEAR_GREED_SYMBOLS[key]);
        });
    });
});
