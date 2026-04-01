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
import type {
    CandlePattern,
    MultiCandlePattern,
} from '@/domain/analysis/candle';
import {
    detectCandlePattern,
    detectMultiCandlePattern,
} from '@/domain/analysis/candle';
import {
    getCandlePatternLabel,
    getMultiCandlePatternLabel,
} from '@/domain/analysis/candle-labels';
import { CANDLE_PATTERN_DETECTION_BARS } from '@/domain/analysis/prompt';

// --- Types -------------------------------------------------------------------

type PatternTrend = 'bullish' | 'bearish' | 'neutral';

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

// --- Pattern Trend Classification -------------------------------------------

const BULLISH_SINGLE_PATTERNS: ReadonlySet<CandlePattern> = new Set([
    'hammer',
    'inverted_hammer',
    'bullish_marubozu',
    'bullish_belt_hold',
    'dragonfly_doji',
]);

const BEARISH_SINGLE_PATTERNS: ReadonlySet<CandlePattern> = new Set([
    'shooting_star',
    'hanging_man',
    'bearish_marubozu',
    'bearish_belt_hold',
    'gravestone_doji',
]);

const BULLISH_MULTI_PATTERNS: ReadonlySet<MultiCandlePattern> = new Set([
    'bullish_engulfing',
    'bullish_harami',
    'bullish_harami_cross',
    'piercing_line',
    'bullish_counterattack_line',
    'morning_star',
    'morning_doji_star',
    'bullish_abandoned_baby',
    'three_white_soldiers',
    'three_inside_up',
    'three_outside_up',
    'bullish_triple_star',
    'ladder_bottom',
    'tweezers_bottom',
    'downside_gap_two_rabbits',
]);

const BEARISH_MULTI_PATTERNS: ReadonlySet<MultiCandlePattern> = new Set([
    'bearish_engulfing',
    'bearish_harami',
    'bearish_harami_cross',
    'dark_cloud_cover',
    'bearish_counterattack_line',
    'evening_star',
    'evening_doji_star',
    'bearish_abandoned_baby',
    'three_black_crows',
    'three_inside_down',
    'three_outside_down',
    'bearish_triple_star',
    'advance_block',
    'tweezers_top',
    'upside_gap_two_crows',
]);

const EXCLUDED_SINGLE_PATTERNS: ReadonlySet<CandlePattern> = new Set([
    'bullish',
    'bearish',
    'flat',
    'spinning_top',
]);

// --- Helpers -----------------------------------------------------------------

const getSinglePatternTrend = (pattern: CandlePattern): PatternTrend => {
    if (BULLISH_SINGLE_PATTERNS.has(pattern)) return 'bullish';
    if (BEARISH_SINGLE_PATTERNS.has(pattern)) return 'bearish';
    return 'neutral';
};

const getMultiPatternTrend = (pattern: MultiCandlePattern): PatternTrend => {
    if (BULLISH_MULTI_PATTERNS.has(pattern)) return 'bullish';
    if (BEARISH_MULTI_PATTERNS.has(pattern)) return 'bearish';
    return 'neutral';
};

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

// --- Entry Detection (mirrors buildCandlePatternEntries from prompt.ts) ------

const detectPatternEntries = (bars: Bar[]): CandlePatternMarkerEntry[] => {
    const patternBars = bars.slice(-CANDLE_PATTERN_DETECTION_BARS);

    const multiEntries: CandlePatternMarkerEntry[] = patternBars.flatMap(
        (_, i) => {
            const candleWindow = patternBars.slice(0, i + 1);
            const detected = detectMultiCandlePattern(candleWindow);
            if (detected === null) return [];
            return [
                {
                    time: patternBars[i].time,
                    trend: getMultiPatternTrend(detected),
                    label: getMultiCandlePatternLabel(detected),
                },
            ];
        }
    );

    const multiBarIndices = new Set(
        multiEntries.map(e => patternBars.findIndex(bar => bar.time === e.time))
    );

    const singleEntries: CandlePatternMarkerEntry[] = patternBars
        .map((bar, i) => {
            if (multiBarIndices.has(i)) return null;
            const pattern = detectCandlePattern(bar);
            if (EXCLUDED_SINGLE_PATTERNS.has(pattern)) return null;
            return {
                time: bar.time,
                trend: getSinglePatternTrend(pattern),
                label: getCandlePatternLabel(pattern),
            };
        })
        .filter((entry): entry is CandlePatternMarkerEntry => entry !== null);

    return [...singleEntries, ...multiEntries].sort((a, b) => a.time - b.time);
};

// --- Hook --------------------------------------------------------------------

export function useCandlePatternMarkers({
    seriesRef,
    bars,
}: UseCandlePatternMarkersParams): UseCandlePatternMarkersReturn {
    const [isVisible, setIsVisible] = useState(false);

    const markersPluginRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null);

    const entries = useMemo(() => detectPatternEntries(bars), [bars]);

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
            markersPluginRef.current.setMarkers(entries.map(toMarker));
        } else {
            markersPluginRef.current.setMarkers([]);
        }
    }, [seriesRef, entries, isVisible]);

    useEffect(() => {
        return () => {
            markersPluginRef.current?.detach();
            markersPluginRef.current = null;
        };
    }, []);

    return { isVisible, toggle };
}
