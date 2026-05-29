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
const TRADING_DAYS_52W = 252;

function lastNonNull(arr: readonly (number | null)[]): number | null {
    for (let i = arr.length - 1; i >= 0; i--) {
        const v = arr[i];
        if (v !== null) return v;
    }
    return null;
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
    if (bars.length < 2) return null;
    const last = bars[bars.length - 1];
    const prev = bars[bars.length - 2];
    if (prev.close === 0) return null;

    const changePercent = ((last.close - prev.close) / prev.close) * 100;
    const window = bars.slice(-TRADING_DAYS_52W);
    const high52w = Math.max(...window.map(b => b.high));
    const low52w = Math.min(...window.map(b => b.low));

    return {
        lastClose: last.close,
        changePercent,
        rsi: lastNonNull(indicators.rsi),
        macdHistogram: lastNonNull(indicators.macd.map(m => m.histogram)),
        high52w,
        low52w,
        pctFrom52wHigh:
            high52w === 0 ? 0 : ((last.close - high52w) / high52w) * 100,
        pctAbove52wLow:
            low52w === 0 ? 0 : ((last.close - low52w) / low52w) * 100,
    };
}
