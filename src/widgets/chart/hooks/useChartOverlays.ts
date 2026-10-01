'use client';

import type { RefObject } from 'react';
import { useEffect, useRef } from 'react';
import {
    createSeriesMarkers,
    LineSeries,
    LineStyle,
    type IChartApi,
    type ISeriesApi,
    type Time,
} from 'lightweight-charts';
import type { OverlayLineSpec } from '../utils/chartOverlayUtils';
import { DEFAULT_LINE_WIDTH } from '../constants';
import { createRightExtendPrimitive } from '../utils/rightExtendPrimitive';

/** lightweight-charts `LineWidth` 상한. */
const MAX_LINE_WIDTH = 4;

const OVERLAY_SERIES_OPTIONS = {
    lastValueVisible: false,
    priceLineVisible: false,
    crosshairMarkerVisible: false,
    // 오버레이가 가격축 범위를 넓히면 캔들이 납작해진다 — 자동 스케일에서 뺀다.
    autoscaleInfoProvider: () => null,
} as const;

function withOpacity(hex: string, opacity: number): string {
    if (opacity >= 1 || !/^#[0-9a-f]{6}$/i.test(hex)) return hex;
    return `${hex}${Math.round(opacity * 255)
        .toString(16)
        .padStart(2, '0')}`;
}

interface UseChartOverlaysParams {
    chartRef: RefObject<IChartApi | null>;
    specs: readonly OverlayLineSpec[];
    lineWidth?: number;
}

/**
 * `chartOverlays[]`(패턴·추세선·다이버전스·피보나치·엘리어트)를 `LineSeries`로
 * 그린다. 하나의 스펙 = 선분 하나(2점) 또는 레벨 하나(수평선) = 시리즈 하나.
 * 레벨 스펙(`extendRight`)은 primitive로 마지막 봉 ~ 가격축 앞까지 덧그린다.
 *
 * 라벨(HS의 LS/H/RS 등)은 선분/레벨 시리즈 위가 아니라 **라벨 전용 투명
 * 시리즈**에 마커로 단다 — 라벨 시각이 선분의 두 끝점 밖일 수 있어(예: 헤드
 * 라벨이 첫 세그먼트 범위 밖) lightweight-charts 마커가 그 시리즈 데이터에
 * 없는 시각을 그릴 수 없기 때문이다.
 */
export function useChartOverlays({
    chartRef,
    specs,
    lineWidth = DEFAULT_LINE_WIDTH,
}: UseChartOverlaysParams): void {
    const seriesRef = useRef<ISeriesApi<'Line'>[]>([]);

    useEffect(() => {
        const chart = chartRef.current;
        if (!chart) return;

        const created = specs
            .map(spec => {
                // lightweight-charts `LineWidth`는 1~4 리터럴이다 — 양 끝을 잘라
                // 그 범위를 보장하므로 캐스트가 안전하다(강조 배수·기본 두께가
                // 커져도 5 이상이 새지 않는다).
                const resolvedWidth = Math.min(
                    MAX_LINE_WIDTH,
                    Math.max(1, Math.round(lineWidth * spec.lineWidthMult))
                ) as 1 | 2 | 3 | 4;
                const color = withOpacity(spec.color, spec.opacity);
                const series = chart.addSeries(
                    LineSeries,
                    {
                        ...OVERLAY_SERIES_OPTIONS,
                        color,
                        lineWidth: resolvedWidth,
                        lineStyle: spec.dashed
                            ? LineStyle.Dashed
                            : LineStyle.Solid,
                        title: spec.title,
                    },
                    spec.paneIndex
                );
                series.setData(
                    spec.points.map(p => ({
                        time: p.time as Time,
                        value: p.value,
                    }))
                );
                if (spec.extendRight) {
                    const [, end] = spec.points;
                    // core 작도 시각은 봉 시각과 같은 UTC 초(UTCTimestamp)라 `Time`으로
                    // 그대로 쓸 수 있다 — 위 `setData`의 `p.time as Time`과 같은 근거.
                    series.attachPrimitive(
                        createRightExtendPrimitive({
                            startTime: end.time as Time,
                            price: end.value,
                            color,
                            lineWidth: resolvedWidth,
                            dashed: spec.dashed,
                        })
                    );
                }

                if (spec.markers.length === 0) return [series];

                // 라벨 전용 투명 시리즈 — 값은 라벨 가격이다(0을 넣으면 aboveBar/belowBar
                // 배치가 항상 바닥 기준이 된다).
                const labelSeries = chart.addSeries(
                    LineSeries,
                    {
                        ...OVERLAY_SERIES_OPTIONS,
                        color: 'transparent',
                        lineVisible: false,
                    },
                    spec.paneIndex
                );
                // 시각 오름차순 정렬은 여기 한 곳에서만 한다 — 라벨 시리즈 데이터와
                // 마커 둘 다 이 정렬된 배열을 재사용해, 시리즈 데이터(정렬 필요)와
                // 마커(정렬 불필요)가 서로 다른 순서를 갖는 것을 방지한다.
                const sortedMarkers = spec.markers.toSorted(
                    (a, b) => a.time - b.time
                );
                // 시리즈 데이터는 시각이 엄격히 오름차순이어야 한다 — 같은 봉에 라벨이
                // 둘(예: 한 봉의 고가·저가가 모두 피벗)이면 첫 점만 남긴다. 마커는 같은
                // 시각에 여러 개 달 수 있으므로 그대로 둔다.
                const labelPoints = sortedMarkers.filter(
                    (m, i, arr) => i === 0 || m.time !== arr[i - 1].time
                );
                labelSeries.setData(
                    labelPoints.map(m => ({
                        time: m.time as Time,
                        value: m.price,
                    }))
                );
                createSeriesMarkers(
                    labelSeries,
                    sortedMarkers.map(m => ({
                        time: m.time as Time,
                        position: m.position,
                        shape: 'circle',
                        size: 0,
                        color: withOpacity(spec.color, spec.opacity),
                        text: m.text,
                    }))
                );
                return [series, labelSeries];
            })
            .flat();

        seriesRef.current = created;
        return () => {
            for (const s of seriesRef.current) {
                try {
                    chart.removeSeries(s);
                } catch {
                    // 차트가 먼저 제거된 경우(언마운트 순서) — 무시.
                }
            }
            seriesRef.current = [];
        };
    }, [chartRef, specs, lineWidth]);
}
