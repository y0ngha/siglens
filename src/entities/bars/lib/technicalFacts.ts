import type { Bar, IndicatorResult } from '@y0ngha/siglens-core';

/** chart 사실 층에 표시하는 결정적 기술 지표 묶음. */
export interface TechnicalFacts {
    lastClose: number;
    /** 직전 봉 종가 대비 % 변화. */
    changePercent: number;
    /** 마지막 non-null RSI. 없으면 null. */
    rsi: number | null;
    /** 마지막 non-null MACD histogram. 부호로 모멘텀 방향 판정. 없으면 null. */
    macdHistogram: number | null;
    high52w: number;
    low52w: number;
    /** 최근 윈도우 고점 대비 % (<= 0). */
    pctFrom52wHigh: number;
    /** 최근 윈도우 저점 대비 % (>= 0). */
    pctAbove52wLow: number;
}

// timeframe prop 없이도 결정적으로 계산하기 위해 마지막 RECENT_BARS_WINDOW 봉만 사용한다.
export const RECENT_BARS_WINDOW = 252;

// 등락률 계산에 직전 봉(prev)과 마지막 봉(last)이 필요하므로 최소 2개 봉이 있어야 한다.
const MIN_BARS_FOR_FACTS = 2;

function lastNonNull(arr: readonly (number | null)[]): number | null {
    return arr.findLast((v): v is number => v !== null) ?? null;
}

/**
 * bars/indicators에서 결정적 사실을 추출한다. bars가 2개 미만이거나 직전
 * 종가가 0이면(등락률 분모 0) null을 반환해 호출부가 섹션을 graceful 생략한다.
 * 순수 함수 — 시간/난수 의존 없음.
 */
export function buildTechnicalFacts(
    bars: readonly Bar[],
    indicators: IndicatorResult
): TechnicalFacts | null {
    if (bars.length < MIN_BARS_FOR_FACTS) return null;
    const last = bars[bars.length - 1];
    const prev = bars[bars.length - 2];
    if (prev.close === 0) return null;

    const changePercent = ((last.close - prev.close) / prev.close) * 100;
    const recentBars = bars.slice(-RECENT_BARS_WINDOW);
    const high52w = Math.max(...recentBars.map(b => b.high));
    const low52w = Math.min(...recentBars.map(b => b.low));

    return {
        lastClose: last.close,
        changePercent,
        rsi: lastNonNull(indicators.rsi),
        macdHistogram: lastNonNull(indicators.macd.map(m => m.histogram)),
        high52w,
        low52w,
        // high52w === 0 분기는 도달 불가능한 방어 가드다: prev 봉은 recentBars에
        // 포함되고 prev.high >= prev.close이며, 위에서 prev.close === 0을 이미 걸러
        // prev.close > 0이므로 high52w >= prev.high >= prev.close > 0. (방어 유지)
        pctFrom52wHigh:
            high52w === 0 ? 0 : ((last.close - high52w) / high52w) * 100,
        pctAbove52wLow:
            low52w === 0 ? 0 : ((last.close - low52w) / low52w) * 100,
    };
}
