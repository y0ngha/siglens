import { calculateMA, MA_DEFAULT_PERIODS } from '@y0ngha/siglens-core';
import type { Bar, IndicatorResult } from '@y0ngha/siglens-core';

/**
 * 차트가 core 기본 기간에 더해 보이는 이동평균 기간. 골든크로스 50/200 정의가 가리키는 50일선이
 * core 기본값(`MA_DEFAULT_PERIODS`)에 없다 — 그 상수는 분석 프롬프트가 쓰므로 core를 건드리지 않고
 * 차트 옵션에만 더한다.
 */
const CHART_EXTRA_MA_PERIODS: readonly number[] = [50];

/** 차트 이동평균 옵션 목록 — core 기본 기간과 차트 전용 기간의 합집합(오름차순). */
export const CHART_MA_PERIODS: readonly number[] = [
    ...new Set([...MA_DEFAULT_PERIODS, ...CHART_EXTRA_MA_PERIODS]),
].sort((a, b) => a - b);

/**
 * core 결과에 없는 차트 이동평균 기간을 이미 차트에 있는 `bars`로 계산해 `ma`에 채운다.
 * 추가 fetch도 서버 페이로드 변경도 없다. 빠진 기간이 없으면 같은 참조를 돌려준다.
 */
export function withChartMaPeriods(
    indicators: IndicatorResult,
    bars: Bar[]
): IndicatorResult {
    const missing = CHART_MA_PERIODS.filter(
        period => indicators.ma[period] === undefined
    );
    if (missing.length === 0) return indicators;

    return {
        ...indicators,
        ma: {
            ...indicators.ma,
            ...Object.fromEntries(
                missing.map(period => [period, calculateMA(bars, period)])
            ),
        },
    };
}
