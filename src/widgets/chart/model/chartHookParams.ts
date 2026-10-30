/**
 * 지표 훅 공통 인자 — 가격 오버레이·보조 패인 훅이 같은 차트·봉·지표·선 두께를 받는다.
 */
import type { RefObject } from 'react';
import type { IChartApi, LineWidth } from 'lightweight-charts';
import type { Bar, IndicatorResult } from '@y0ngha/siglens-core';

export interface IndicatorHookParams {
    /** 시간외 구간에서 끊기는 지표 전용 차트 어댑터(`extendedGapChart`). */
    chartRef: RefObject<IChartApi | null>;
    /** 정규장 봉 — 지표는 이 배열과 tail 정렬된다. */
    bars: Bar[];
    indicators: IndicatorResult;
    lineWidth: LineWidth;
}
