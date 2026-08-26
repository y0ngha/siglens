'use client';

import type { RefObject } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
    ISeriesApi,
    ISeriesMarkersPluginApi,
    SeriesMarkerBar,
    UTCTimestamp,
} from 'lightweight-charts';
import { createSeriesMarkers } from 'lightweight-charts';
import { CHART_COLORS } from '@/shared/lib/chartColors';
import {
    type Bar,
    type CandlePatternEntry,
    type PatternTrend,
    detectCandlePatternEntries,
    getDetectionBars,
    selectLastCandlePatternEntries,
    getCandlePatternLabel,
    getMultiCandlePatternLabel,
    getMultiPatternTrend,
    getSinglePatternTrend,
} from '@y0ngha/siglens-core';

// --- Types -------------------------------------------------------------------

interface CandlePatternMarkerEntry {
    time: number;
    trend: PatternTrend;
    label: string;
}

interface MarkerStyle {
    position: 'aboveBar' | 'belowBar';
    shape: 'arrowUp' | 'arrowDown' | 'circle';
    color: string;
}

interface UseCandlePatternMarkersParams {
    seriesRef: RefObject<ISeriesApi<'Candlestick', UTCTimestamp> | null>;
    bars: Bar[];
}

interface UseCandlePatternMarkersReturn {
    isVisible: boolean;
    toggle: () => void;
}

// --- Helpers -----------------------------------------------------------------

// 모듈 상수 맵으로 두면 로드 시점의 테마 색이 굳는다 — 호출 시점에 만든다.
const markerStyle = (trend: PatternTrend): MarkerStyle => {
    if (trend === 'bullish') {
        return {
            position: 'belowBar',
            shape: 'arrowUp',
            color: CHART_COLORS.bullish,
        };
    }
    if (trend === 'bearish') {
        return {
            position: 'aboveBar',
            shape: 'arrowDown',
            color: CHART_COLORS.bearish,
        };
    }
    return {
        position: 'aboveBar',
        shape: 'circle',
        color: CHART_COLORS.neutral,
    };
};

const toMarker = (
    entry: CandlePatternMarkerEntry
): SeriesMarkerBar<UTCTimestamp> => {
    const style = markerStyle(entry.trend);
    return {
        time: entry.time as UTCTimestamp,
        position: style.position,
        shape: style.shape,
        color: style.color,
        text: entry.label,
    };
};

const entryToMarkerEntry = (
    entry: CandlePatternEntry,
    detectionBars: Bar[]
): CandlePatternMarkerEntry => {
    const bar = detectionBars[entry.barIndex];
    if (entry.patternType === 'multi') {
        return {
            time: bar.time,
            trend: getMultiPatternTrend(entry.multiPattern),
            label: getMultiCandlePatternLabel(entry.multiPattern),
        };
    }
    return {
        time: bar.time,
        trend: getSinglePatternTrend(entry.singlePattern),
        label: getCandlePatternLabel(entry.singlePattern),
    };
};

/** Maps selected CandlePatternEntry[] to CandlePatternMarkerEntry[] for chart rendering. */
const toMarkerEntries = (
    entries: CandlePatternEntry[],
    detectionBars: Bar[]
): CandlePatternMarkerEntry[] =>
    selectLastCandlePatternEntries(entries).map(entry =>
        entryToMarkerEntry(entry, detectionBars)
    );

// --- Hook --------------------------------------------------------------------

export function useCandlePatternMarkers({
    seriesRef,
    bars,
}: UseCandlePatternMarkersParams): UseCandlePatternMarkersReturn {
    const [isVisible, setIsVisible] = useState(false);

    const markersPluginRef =
        useRef<ISeriesMarkersPluginApi<UTCTimestamp> | null>(null);

    const markers = useMemo(() => {
        const entries = detectCandlePatternEntries(bars);
        const detectionBars = getDetectionBars(bars);
        return toMarkerEntries(entries, detectionBars);
    }, [bars]);

    const toggle = useCallback(() => {
        setIsVisible(prev => !prev);
    }, []);

    // Initialization + cleanup (mount/unmount)
    useEffect(() => {
        if (!seriesRef.current) return;
        markersPluginRef.current = createSeriesMarkers(seriesRef.current, []);
        return () => {
            markersPluginRef.current?.detach();
            markersPluginRef.current = null;
        };
    }, [seriesRef]);

    // Data synchronization
    useEffect(() => {
        if (!markersPluginRef.current) return;
        markersPluginRef.current.setMarkers(
            isVisible ? markers.map(toMarker) : []
        );
    }, [markers, isVisible]);

    return { isVisible, toggle };
}
