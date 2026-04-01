'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { createSeriesMarkers } from 'lightweight-charts';
import type {
    ISeriesApi,
    ISeriesMarkersPluginApi,
    SeriesMarkerBar,
    Time,
    UTCTimestamp,
} from 'lightweight-charts';
import { CHART_COLORS } from '@/domain/constants/colors';
import type { Bar } from '@/domain/types';
import {
    CANDLE_PATTERN_DETECTION_BARS,
    detectCandlePatternEntries,
    MULTI_CANDLE_PATTERN_BUFFER,
} from '@/domain/analysis/candle-detection';
import type { CandlePatternEntry } from '@/domain/analysis/candle-detection';
import { detectCandlePattern } from '@/domain/analysis/candle';
import {
    getCandlePatternLabel,
    getMultiCandlePatternLabel,
} from '@/domain/analysis/candle-labels';
import {
    getSinglePatternTrend,
    getMultiPatternTrend,
    EXCLUDED_SINGLE_PATTERNS,
} from '@/domain/analysis/candle-trend';
import type { PatternTrend } from '@/domain/analysis/candle-trend';

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
    seriesRef: RefObject<ISeriesApi<'Candlestick'> | null>;
    bars: Bar[];
}

interface UseCandlePatternMarkersReturn {
    isVisible: boolean;
    toggle: () => void;
}

// --- Helpers -----------------------------------------------------------------

const MARKER_STYLE_MAP: Record<PatternTrend, MarkerStyle> = {
    bullish: {
        position: 'belowBar',
        shape: 'arrowUp',
        color: CHART_COLORS.bullish,
    },
    bearish: {
        position: 'aboveBar',
        shape: 'arrowDown',
        color: CHART_COLORS.bearish,
    },
    neutral: {
        position: 'aboveBar',
        shape: 'circle',
        color: CHART_COLORS.neutral,
    },
};

const toMarker = (entry: CandlePatternMarkerEntry): SeriesMarkerBar<Time> => {
    const style = MARKER_STYLE_MAP[entry.trend];
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

/**
 * Creates single-candle markers for specific bars (used for bars involved in a multi-candle pattern).
 * Excluded single patterns (bullish, bearish, flat, spinning_top) are skipped.
 */
const createSingleMarkersForBars = (
    detectionBars: Bar[],
    barIndices: number[]
): CandlePatternMarkerEntry[] =>
    barIndices
        .map(idx => {
            const bar = detectionBars[idx];
            const pattern = detectCandlePattern(bar);
            if (EXCLUDED_SINGLE_PATTERNS.has(pattern)) return null;
            return {
                time: bar.time,
                trend: getSinglePatternTrend(pattern),
                label: getCandlePatternLabel(pattern),
            };
        })
        .filter((entry): entry is CandlePatternMarkerEntry => entry !== null);

/**
 * Selects markers for the last detected pattern only:
 * - If a multi-candle pattern exists: show the multi pattern marker + single pattern markers
 *   for each bar involved in that multi-candle pattern
 * - If only single patterns exist: show the last single pattern marker only (1 bar)
 */
const selectLastPatternMarkers = (
    entries: CandlePatternEntry[],
    detectionBars: Bar[]
): CandlePatternMarkerEntry[] => {
    if (entries.length === 0) return [];

    const lastMultiEntry = [...entries]
        .reverse()
        .find(e => e.patternType === 'multi');

    if (lastMultiEntry !== undefined) {
        const multiMarker = entryToMarkerEntry(lastMultiEntry, detectionBars);
        // Get single markers for each bar in the multi pattern range
        const multiBarIndex = lastMultiEntry.barIndex;
        const startBarIndex = Math.max(
            0,
            multiBarIndex - MULTI_CANDLE_PATTERN_BUFFER
        );
        const involvedIndices = Array.from(
            { length: multiBarIndex - startBarIndex + 1 },
            (_, offset) => startBarIndex + offset
        );
        const singleMarkers = createSingleMarkersForBars(
            detectionBars,
            involvedIndices
        );

        return [...singleMarkers, multiMarker].sort((a, b) => a.time - b.time);
    }

    // Only single patterns: show the last one
    const lastSingleEntry = entries[entries.length - 1];
    return [entryToMarkerEntry(lastSingleEntry, detectionBars)];
};

// --- Hook --------------------------------------------------------------------

export function useCandlePatternMarkers({
    seriesRef,
    bars,
}: UseCandlePatternMarkersParams): UseCandlePatternMarkersReturn {
    const [isVisible, setIsVisible] = useState(false);

    const markersPluginRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null);

    const markers = useMemo(() => {
        const entries = detectCandlePatternEntries(bars);
        const detectionBars = bars.slice(
            -Math.min(bars.length, CANDLE_PATTERN_DETECTION_BARS)
        );
        return selectLastPatternMarkers(entries, detectionBars);
    }, [bars]);

    const toggle = useCallback(() => {
        setIsVisible(prev => !prev);
    }, []);

    useEffect(() => {
        if (!seriesRef.current) return;

        if (!markersPluginRef.current) {
            markersPluginRef.current = createSeriesMarkers(
                seriesRef.current,
                []
            );
        }

        if (isVisible) {
            markersPluginRef.current.setMarkers(markers.map(toMarker));
        } else {
            markersPluginRef.current.setMarkers([]);
        }
    }, [seriesRef, markers, isVisible]);

    useEffect(() => {
        return () => {
            markersPluginRef.current?.detach();
            markersPluginRef.current = null;
        };
    }, []);

    return { isVisible, toggle };
}
