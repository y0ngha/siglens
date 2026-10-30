'use client';

/**
 * 프리·애프터마켓 구간 음영 밴드를 시리즈에 붙이는 훅.
 */

import { type RefObject, useEffect } from 'react';
import type {
    ISeriesApi,
    ISeriesPrimitive,
    SeriesType,
    Time,
} from 'lightweight-charts';
import { CHART_COLORS } from '@/shared/lib/chartColors';
import type { ExtendedSessionRange } from '@/shared/api/market/extendedBarsSession';
import { createExtendedSessionPrimitive } from '../utils/extendedSessionPrimitive';

/**
 * 프리·애프터마켓 구간 음영을 시리즈에 붙인다. 구간이 없으면 아무것도 붙이지 않는다(기존 차트와
 * 같다). 가격 차트·거래량 차트가 같은 훅을 쓰므로 두 차트의 밴드가 같은 구간·같은 색이다.
 *
 * 색은 붙이는 순간의 테마로 읽는다 — 테마가 바뀌면 마운트 지점의 `key={themeVersion}`이 차트를 통째로
 * remount하므로 이 훅도 새 팔레트로 다시 돈다.
 */
export function useExtendedSessionBand<T extends Time>(
    seriesRef: RefObject<ISeriesApi<SeriesType, T> | null>,
    ranges: readonly ExtendedSessionRange[]
): void {
    useEffect(() => {
        const series = seriesRef.current;
        if (!series || ranges.length === 0) return;
        const band = createExtendedSessionPrimitive(
            CHART_COLORS.extendedSessionBand
        );
        band.setRanges(ranges);
        // 시리즈의 시간 타입(`UTCTimestamp` 등)과 무관하게 같은 primitive를 붙인다 — 좌표는 시각 값으로만 읽는다.
        const primitive = band as unknown as ISeriesPrimitive<T>;
        series.attachPrimitive(primitive);
        return () => {
            try {
                series.detachPrimitive(primitive);
            } catch {
                // 차트가 먼저 제거된 경우 — 시리즈와 함께 primitive도 이미 떨어졌다.
            }
        };
    }, [seriesRef, ranges]);
}
