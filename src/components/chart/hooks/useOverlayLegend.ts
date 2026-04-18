'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { RefObject } from 'react';
import type { IChartApi } from 'lightweight-charts';
import type { Bar, IndicatorResult } from '@/domain/types';
import type { OverlayLegendItem } from '@/components/chart/types';
import {
    findBarIndex,
    type OverlayLabelConfig,
    resolveBarIndex,
    resolveOverlayValues,
} from '@/components/chart/utils/overlayLabelUtils';

interface UseOverlayLegendParams {
    chartRef: RefObject<IChartApi | null>;
    bars: Bar[];
    indicators: IndicatorResult;
    labelConfigs: OverlayLabelConfig[];
}

export function useOverlayLegend({
    chartRef,
    bars,
    indicators,
    labelConfigs,
}: UseOverlayLegendParams): OverlayLegendItem[] {
    const [crosshairIndex, setCrosshairIndex] = useState<number | null>(null);

    const barsRef = useRef<Bar[]>(bars);

    const barIndex = resolveBarIndex(bars, crosshairIndex);

    const legendItems = useMemo(
        () => resolveOverlayValues(labelConfigs, indicators, barIndex),
        [labelConfigs, indicators, barIndex]
    );

    useEffect(() => {
        barsRef.current = bars;
    }, [bars]);

    useEffect(() => {
        const chart = chartRef.current;

        if (!chart) return;

        const handler = (param: { time?: unknown }): void => {
            if (typeof param.time === 'number') {
                const idx = findBarIndex(barsRef.current, param.time);

                setCrosshairIndex(prev => (prev === idx ? prev : idx));
            } else {
                setCrosshairIndex(prev => (prev === null ? prev : null));
            }
        };

        chart.subscribeCrosshairMove(handler);

        return () => {
            // effect 시작 시점의 chart를 캡처하지 않고 chartRef.current를 다시 읽는 이유:
            // 부모가 chart.remove()로 차트를 먼저 dispose하면 chartRef.current는 null이 된다.
            // 이미 dispose된 인스턴스에 unsubscribeCrosshairMove를 호출하면
            // lightweight-charts가 "Object is disposed" 에러를 던지므로,
            // optional chaining으로 dispose 이후의 호출을 건너뛴다.
            //
            // react-hooks/exhaustive-deps는 "cleanup 시점의 ref.current가 effect 실행 시점과
            // 다를 수 있다"며 로컬 변수로 캡처할 것을 권고하지만, 여기서는 바로 그 "달라진
            // 값(null)"을 이용해 dispose 여부를 감지하는 것이 의도이므로 규칙을 비활성화한다.
            // eslint-disable-next-line react-hooks/exhaustive-deps
            chartRef.current?.unsubscribeCrosshairMove(handler);
        };
    }, [chartRef]);

    return legendItems;
}
