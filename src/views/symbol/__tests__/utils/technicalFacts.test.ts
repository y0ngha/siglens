import type { Bar, IndicatorResult } from '@y0ngha/siglens-core';
import { describe, expect, it } from 'vitest';
import {
    buildTechnicalFacts,
    buildTechnicalFactsNarrative,
} from '../../utils/technicalFacts';

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
        macdV: [],
        connorsRsi: [],
        forceIndex: [],
        elderRay: [],
        elderImpulse: [],
        bollingerDerived: [],
        chandelierExit: [],
        yangZhang: [],
        ewmaVolatility: [],
        hurst: [],
        varianceRatio: [],
        regression: [],
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

    it('현재가·등락률·최근 구간 위치를 산출한다', () => {
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

    it('최근 구간 저점이 0이면 pctAbove52wLow를 0으로 안전 처리한다', () => {
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

describe('buildTechnicalFactsNarrative', () => {
    it('전체 기술 사실 서사를 결정적으로 생성한다', () => {
        const facts = buildTechnicalFacts(
            [bar(100, 120, 90), bar(110, 115, 100)],
            indicators({
                rsi: [null, 62.5],
                macd: [{ macd: 1, signal: 0.5, histogram: 0.3 }],
            })
        );

        expect(
            buildTechnicalFactsNarrative('AAPL', facts!, 'us-equity')
        ).toEqual([
            'AAPL은 최근 종가 $110.00 기준으로 직전 봉 대비 10.00% 상승했습니다.',
            'RSI 62.5로 중립 구간이며, MACD 히스토그램은 양수라 단기 모멘텀은 상승 쪽입니다.',
            '최근 252개 봉 고점 대비 -8.3%, 저점 대비 +22.2% 위치에 있습니다.',
        ]);
    });

    it('RSI와 MACD가 모두 null이면 모멘텀 문장을 생략하고 음수 등락은 하락으로 표현한다', () => {
        const facts = buildTechnicalFacts(
            [bar(100, 120, 80), bar(90, 95, 85)],
            indicators({
                rsi: [null, null],
                macd: [{ macd: null, signal: null, histogram: null }],
            })
        );

        expect(
            buildTechnicalFactsNarrative('AAPL', facts!, 'us-equity')
        ).toEqual([
            'AAPL은 최근 종가 $90.00 기준으로 직전 봉 대비 10.00% 하락했습니다.',
            '최근 252개 봉 고점 대비 -25.0%, 저점 대비 +12.5% 위치에 있습니다.',
        ]);
    });

    it('MACD histogram이 0이면 서사에서 중립에 가까운 상태로 표현한다', () => {
        const facts = buildTechnicalFacts(
            [bar(100, 120, 90), bar(110, 115, 100)],
            indicators({
                rsi: [null, 50],
                macd: [{ macd: 0, signal: 0, histogram: 0 }],
            })
        );

        expect(
            buildTechnicalFactsNarrative('AAPL', facts!, 'us-equity')
        ).toEqual([
            'AAPL은 최근 종가 $110.00 기준으로 직전 봉 대비 10.00% 상승했습니다.',
            'RSI 50.0로 중립 구간이며, MACD 히스토그램은 0이라 단기 모멘텀은 중립에 가까운 상태입니다.',
            '최근 252개 봉 고점 대비 -8.3%, 저점 대비 +22.2% 위치에 있습니다.',
        ]);
    });

    it('crypto sub-cent 가격은 crypto precision으로 서사에 표시한다', () => {
        const facts = buildTechnicalFacts(
            [bar(0.05, 0.06, 0.04), bar(0.058158, 0.06, 0.05)],
            indicators({})
        );

        const narrative = buildTechnicalFactsNarrative(
            'BTCUSD',
            facts!,
            'crypto'
        );

        expect(narrative[0]).toContain('$0.05816 기준');
        expect(narrative[0]).not.toContain('$0.06 기준');
    });
});
