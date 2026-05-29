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
    /** 52주 고점 대비 % (<= 0). */
    pctFrom52wHigh: number;
    /** 52주 저점 대비 % (>= 0). */
    pctAbove52wLow: number;
}

// 미국 정규장 1년 ≈ 252 거래일. 일봉 기준 52주 윈도.
// @y0ngha/siglens-core에는 동일한 "연간 거래일/52주 봉 개수" 상수가 없어(확인: core
// 숫자 export 목록에 TRADING/252/YEAR/52 매칭 없음) 로컬에 유지한다. core가 추가하면 교체.
const TRADING_DAYS_52W = 252;

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
    const bars52w = bars.slice(-TRADING_DAYS_52W);
    const high52w = Math.max(...bars52w.map(b => b.high));
    const low52w = Math.min(...bars52w.map(b => b.low));

    return {
        lastClose: last.close,
        changePercent,
        rsi: lastNonNull(indicators.rsi),
        macdHistogram: lastNonNull(indicators.macd.map(m => m.histogram)),
        high52w,
        low52w,
        // high52w === 0 분기는 도달 불가능한 방어 가드다: prev 봉은 52주 윈도(bars52w)에
        // 포함되고 prev.high >= prev.close이며, 위에서 prev.close === 0을 이미 걸러
        // prev.close > 0이므로 high52w >= prev.high >= prev.close > 0. (방어 유지)
        pctFrom52wHigh:
            high52w === 0 ? 0 : ((last.close - high52w) / high52w) * 100,
        pctAbove52wLow:
            low52w === 0 ? 0 : ((last.close - low52w) / low52w) * 100,
    };
}
