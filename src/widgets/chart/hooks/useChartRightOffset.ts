'use client';

import type { IChartApi } from 'lightweight-charts';
import { useCallback, useRef } from 'react';
import { applyRightOffsetPixels } from '../utils/rightOffset';

interface ChartRightOffset {
    readonly onChartReady: (chart: IChartApi) => void;
    readonly onChartRemove: () => void;
    readonly onRightGutterChange: (pixels: number) => void;
}

/**
 * 차트 한 장(`StockChart`)에 오른쪽 여백을 연결한다 — `StockChart`가 재는 여백(`onRightGutterChange`)을 시간축에
 * 적용한다. 여백은 차트가 준비되기 전에 올 수도 있어 둘 다 기억해 두고, 준비되면 마지막 값을 적용한다. 여러 차트를
 * 맞춰야 하는 종목 페이지는 `useChartSync`가 같은 일을 한다.
 */
export function useChartRightOffset(): ChartRightOffset {
    const chartRef = useRef<IChartApi | null>(null);
    const pixelsRef = useRef(0);
    const onChartReady = useCallback((chart: IChartApi) => {
        chartRef.current = chart;
        applyRightOffsetPixels(chart, pixelsRef.current);
    }, []);
    const onChartRemove = useCallback(() => {
        chartRef.current = null;
    }, []);
    const onRightGutterChange = useCallback((pixels: number) => {
        pixelsRef.current = pixels;
        if (chartRef.current !== null)
            applyRightOffsetPixels(chartRef.current, pixels);
    }, []);
    return { onChartReady, onChartRemove, onRightGutterChange };
}
