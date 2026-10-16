import type { IndicatorResult } from '@y0ngha/siglens-core';

/**
 * 공개 API `get_chart_data`가 고르게 해 주는 지표 이름의 단일 출처.
 *
 * core의 `IndicatorResult` 키와 1:1이다. 두 방향을 모두 컴파일러/테스트가 지킨다:
 * - 여기에 core에 없는 이름을 적으면 `satisfies`가 빌드를 실패시킨다.
 * - core가 지표를 추가했는데 여기에 없으면 `chartDataIndicators.test.ts`의 타입 단언이 빌드(tsc)를
 *   실패시키고, 같은 파일의 런타임 단언이 실제 `calculateIndicators` 결과로 한 번 더 확인한다 —
 *   새 지표가 API에서 조용히 빠지지 못한다.
 *
 * 순서는 응답 `indicators`의 키 순서이기도 하다(요청 순서를 따르지 않는다 — 같은 요청은 같은 모양).
 */
export const CHART_DATA_INDICATOR_NAMES = [
    'rsi',
    'macd',
    'bollinger',
    'dmi',
    'stochastic',
    'stochRsi',
    'cci',
    'vwap',
    'ma',
    'ema',
    'volumeProfile',
    'ichimoku',
    'atr',
    'obv',
    'parabolicSar',
    'williamsR',
    'supertrend',
    'mfi',
    'keltnerChannel',
    'cmf',
    'donchianChannel',
    'buySellVolume',
    'smc',
    'squeezeMomentum',
    'macdV',
    'connorsRsi',
    'forceIndex',
    'elderRay',
    'elderImpulse',
    'bollingerDerived',
    'chandelierExit',
    'yangZhang',
    'ewmaVolatility',
    'hurst',
    'varianceRatio',
    'regression',
] as const satisfies readonly (keyof IndicatorResult)[];

export type ChartDataIndicatorName =
    (typeof CHART_DATA_INDICATOR_NAMES)[number];

/** `indicators` 인자에서 "전부"를 뜻하는 예약어. 지표 이름과 겹치지 않는다. */
export const CHART_DATA_ALL_INDICATORS = 'all';

/**
 * 봉마다 값이 있는 시리즈가 아니라 전체 구간의 스냅샷인 지표. 응답에서 `time`과 정렬되지 않는다.
 */
export const CHART_DATA_SNAPSHOT_INDICATORS = [
    'volumeProfile',
    'smc',
] as const satisfies readonly ChartDataIndicatorName[];

/** 주기별 키(`{ "20": [...] }`)로 나가는 이동평균 계열. */
export const CHART_DATA_PERIOD_KEYED_INDICATORS = [
    'ma',
    'ema',
] as const satisfies readonly ChartDataIndicatorName[];

/**
 * `indicators` 인자(`undefined`·빈 배열·`["all"]` 포함 시 전부)를 정규 순서의 이름 목록으로 바꾼다.
 * 스키마 검증이 이름을 이미 걸렀지만(`validateArgs`의 enum), 이 함수는 모르는 값을 조용히 버리는
 * 대신 타입으로 좁혀서 돌려준다.
 */
export function resolveChartDataIndicators(
    requested: unknown
): readonly ChartDataIndicatorName[] {
    if (!Array.isArray(requested) || requested.length === 0)
        return CHART_DATA_INDICATOR_NAMES;
    if (requested.includes(CHART_DATA_ALL_INDICATORS))
        return CHART_DATA_INDICATOR_NAMES;
    const wanted = new Set<unknown>(requested);
    return CHART_DATA_INDICATOR_NAMES.filter(name => wanted.has(name));
}
