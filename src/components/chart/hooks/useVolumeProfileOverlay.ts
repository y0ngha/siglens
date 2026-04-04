'use client';

import {
    useCallback,
    useEffect,
    useEffectEvent,
    useRef,
    useState,
} from 'react';
import type { RefObject } from 'react';
import { LineSeries } from 'lightweight-charts';
import type {
    IChartApi,
    ISeriesApi,
    LineWidth,
    UTCTimestamp,
} from 'lightweight-charts';
import type { Bar, IndicatorResult } from '@/domain/types';
import { CHART_COLORS } from '@/lib/colors';
import { DEFAULT_LINE_WIDTH } from '@/components/chart/constants';

interface UseVolumeProfileOverlayParams {
    chartRef: RefObject<IChartApi | null>;
    bars: Bar[];
    indicators: IndicatorResult;
    lineWidth?: LineWidth;
}

interface UseVolumeProfileOverlayReturn {
    isVisible: boolean;
    toggle: () => void;
}

export function useVolumeProfileOverlay({
    chartRef,
    bars,
    indicators,
    lineWidth = DEFAULT_LINE_WIDTH,
}: UseVolumeProfileOverlayParams): UseVolumeProfileOverlayReturn {
    const [isVisible, setIsVisible] = useState(false);
    const prevChartRef = useRef<IChartApi | null>(null);
    const pocSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
    const vahSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
    const valSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);

    const toggle = useCallback(() => {
        setIsVisible(prev => !prev);
    }, []);

    // chart 인스턴스 교체 시 ref만 초기화 (removeSeries 불필요 — 이전 chart는 부모가 소멸)
    const clearSeriesRefs = useEffectEvent(() => {
        pocSeriesRef.current = null;
        vahSeriesRef.current = null;
        valSeriesRef.current = null;
    });

    const removeAllSeries = useEffectEvent((chart: IChartApi) => {
        if (pocSeriesRef.current) {
            chart.removeSeries(pocSeriesRef.current);
            pocSeriesRef.current = null;
        }
        if (vahSeriesRef.current) {
            chart.removeSeries(vahSeriesRef.current);
            vahSeriesRef.current = null;
        }
        if (valSeriesRef.current) {
            chart.removeSeries(valSeriesRef.current);
            valSeriesRef.current = null;
        }
    });

    // 시리즈 lifecycle 관리 (생성/제거)
    // bars, indicators는 의존하지 않음 — 데이터 세팅은 아래 effect가 단독 담당
    useEffect(() => {
        const chart = chartRef.current;

        if (prevChartRef.current !== chart) {
            clearSeriesRefs();
            prevChartRef.current = chart;
        }

        if (!chart) return;

        if (!isVisible) {
            removeAllSeries(chart);
            return;
        }

        const createLineSeries = (color: string) =>
            chart.addSeries(LineSeries, {
                color,
                lineWidth,
                priceLineVisible: false,
                lastValueVisible: false,
            });

        if (!pocSeriesRef.current) {
            pocSeriesRef.current = createLineSeries(CHART_COLORS.vpPoc);
        }
        pocSeriesRef.current.applyOptions({ lineWidth });

        if (!vahSeriesRef.current) {
            vahSeriesRef.current = createLineSeries(CHART_COLORS.vpVah);
        }
        vahSeriesRef.current.applyOptions({ lineWidth });

        if (!valSeriesRef.current) {
            valSeriesRef.current = createLineSeries(CHART_COLORS.vpVal);
        }
        valSeriesRef.current.applyOptions({ lineWidth });
    }, [chartRef, isVisible, lineWidth]);

    // 데이터 동기화: 시리즈가 보이는 동안 bars/indicators 변경 시 업데이트
    // isVisible이 true로 바뀔 때도 실행되어 새로 생성된 시리즈에 초기 데이터를 세팅함
    useEffect(() => {
        if (!isVisible) return;

        if (
            !pocSeriesRef.current ||
            !vahSeriesRef.current ||
            !valSeriesRef.current
        )
            return;

        const { volumeProfile } = indicators;

        if (!volumeProfile || bars.length === 0) {
            pocSeriesRef.current.setData([]);
            vahSeriesRef.current.setData([]);
            valSeriesRef.current.setData([]);
            return;
        }

        const { poc, vah, val } = volumeProfile;

        const toLineData = (value: number) =>
            bars.map((bar: Bar) => ({ time: bar.time as UTCTimestamp, value }));

        pocSeriesRef.current.setData(toLineData(poc));
        vahSeriesRef.current.setData(toLineData(vah));
        valSeriesRef.current.setData(toLineData(val));
    }, [indicators, bars, isVisible]);

    return { isVisible, toggle };
}
