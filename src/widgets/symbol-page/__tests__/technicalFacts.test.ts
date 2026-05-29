import { describe, it, expect } from 'vitest';
import type { Bar, IndicatorResult } from '@y0ngha/siglens-core';
import { buildTechnicalFacts } from '../utils/technicalFacts';

function bar(close: number, high = close, low = close): Bar {
    return { time: 0, open: close, high, low, close, volume: 100 };
}

// 필요한 indicator 필드만 채운 최소 stub (나머지는 빈 배열/객체).
function indicators(partial: Partial<IndicatorResult>): IndicatorResult {
    return {
        macd: [],
        bollinger: [],
        dmi: [],
        stochastic: [],
        stochRsi: [],
        rsi: [],
        cci: [],
        vwap: [],
        ma: {},
        ema: {},
        volumeProfile: null,
        ichimoku: [],
        atr: [],
        obv: [],
        parabolicSar: [],
        williamsR: [],
        supertrend: [],
        mfi: [],
        keltnerChannel: [],
        cmf: [],
        donchianChannel: [],
        buySellVolume: [],
        smc: {} as IndicatorResult['smc'],
        squeezeMomentum: [],
        ...partial,
    };
}

describe('buildTechnicalFacts', () => {
    it('bar가 2개 미만이면 null', () => {
        expect(buildTechnicalFacts([bar(100)], indicators({}))).toBeNull();
    });

    it('직전 봉 종가가 0이면 null을 반환한다 (등락률 분모 0 방어)', () => {
        expect(
            buildTechnicalFacts([bar(0), bar(110)], indicators({}))
        ).toBeNull();
    });

    it('현재가·등락률·52주 위치를 산출한다', () => {
        const bars = [bar(100, 120, 90), bar(110, 115, 100)];
        const facts = buildTechnicalFacts(bars, indicators({}));
        expect(facts).not.toBeNull();
        expect(facts!.lastClose).toBe(110);
        expect(facts!.changePercent).toBeCloseTo(10);
        expect(facts!.high52w).toBe(120);
        expect(facts!.low52w).toBe(90);
        expect(facts!.pctFrom52wHigh).toBeCloseTo(((110 - 120) / 120) * 100);
        expect(facts!.pctAbove52wLow).toBeCloseTo(((110 - 90) / 90) * 100);
    });

    it('RSI·MACD histogram은 마지막 non-null 값을 쓴다', () => {
        const bars = [bar(100), bar(110)];
        const facts = buildTechnicalFacts(
            bars,
            indicators({
                rsi: [null, 62.5],
                macd: [
                    { macd: null, signal: null, histogram: null },
                    { macd: 1, signal: 0.5, histogram: 0.5 },
                ],
            })
        );
        expect(facts!.rsi).toBe(62.5);
        expect(facts!.macdHistogram).toBe(0.5);
    });

    it('RSI가 전부 null이면 rsi=null', () => {
        const facts = buildTechnicalFacts(
            [bar(100), bar(110)],
            indicators({ rsi: [null, null] })
        );
        expect(facts!.rsi).toBeNull();
    });

    it('52주 저점이 0이면 pctAbove52wLow를 0으로 안전 처리한다', () => {
        // low <= close이므로 close>0인 봉도 low:0을 가질 수 있다. 따라서 prev.close가
        // 0이 아니어도(위 가드 통과) low52w === 0은 도달 가능하다.
        const facts = buildTechnicalFacts(
            [bar(5, 10, 0), bar(5, 10, 5)], // low52w = min(0,5) = 0, prev.close = 5
            indicators({})
        );
        expect(facts).not.toBeNull();
        expect(facts!.low52w).toBe(0);
        expect(facts!.pctAbove52wLow).toBe(0);
    });
});
