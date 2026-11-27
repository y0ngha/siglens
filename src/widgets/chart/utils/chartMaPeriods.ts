/**
 * core 지표 결과에 차트 전용 MA 기간(`CHART_ONLY_MA_PERIODS`)을 봉으로 계산해 채운다.
 */

import {
    calculateMA,
    type Bar,
    type IndicatorResult,
} from '@y0ngha/siglens-core';
import { CHART_ONLY_MA_PERIODS } from '../constants';

/**
 * `indicators.ma`에 없는 차트 전용 기간만 `calculateMA(bars, period)`로 채운 결과.
 *
 * 채울 것이 없으면(이미 있거나 봉이 없으면) **같은 참조**를 돌려준다 — 차트 훅들이
 * `indicators`를 effect deps로 쓰므로 새 객체를 만들면 매 렌더 시리즈를 다시 그린다.
 * 값은 봉 하나당 하나라 선 시리즈(tail 정렬)와 범례(봉 인덱스 직접 조회)가 같은 칸을 읽는다.
 */
export function withChartOnlyMaPeriods(
    indicators: IndicatorResult,
    bars: Bar[]
): IndicatorResult {
    if (bars.length === 0) return indicators;
    const missing = CHART_ONLY_MA_PERIODS.filter(
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
