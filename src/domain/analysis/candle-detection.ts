import type { Bar } from '@/domain/types';
import type {
    CandlePattern,
    MultiCandlePattern,
} from '@/domain/analysis/candle';
import {
    detectCandlePattern,
    detectMultiCandlePattern,
} from '@/domain/analysis/candle';
import { EXCLUDED_SINGLE_PATTERNS } from '@/domain/analysis/candle-trend';

// ─── Constants ───────────────────────────────────────────────────────────────

export const CANDLE_PATTERN_DETECTION_BARS = 15;

/** Extra bars needed before the detection window to detect 3-bar multi-candle patterns at the start */
export const MULTI_CANDLE_PATTERN_BUFFER = 2;

const THREE_BAR_PATTERN_COUNT = 3;
const TWO_BAR_PATTERN_COUNT = 2;

/** 3-bar multi-candle patterns */
const THREE_BAR_PATTERNS: ReadonlySet<MultiCandlePattern> = new Set([
    'morning_star',
    'morning_doji_star',
    'evening_star',
    'evening_doji_star',
    'bullish_abandoned_baby',
    'bearish_abandoned_baby',
    'three_white_soldiers',
    'three_black_crows',
    'three_inside_up',
    'three_inside_down',
    'three_outside_up',
    'three_outside_down',
    'bullish_triple_star',
    'bearish_triple_star',
    'upside_gap_two_crows',
    'downside_gap_two_rabbits',
    'advance_block',
    'upside_gap_tasuki',
    'downside_gap_tasuki',
    'ladder_bottom',
]);

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SingleCandlePatternEntry {
    barIndex: number;
    patternType: 'single';
    singlePattern: CandlePattern;
    multiPattern: null;
}

export interface MultiCandlePatternEntry {
    barIndex: number;
    patternType: 'multi';
    singlePattern: null;
    multiPattern: MultiCandlePattern;
}

export type CandlePatternEntry =
    | SingleCandlePatternEntry
    | MultiCandlePatternEntry;

// ─── Helpers ─────────────────────────────────────────────────────────────────

const getPatternBarCount = (pattern: MultiCandlePattern): number =>
    THREE_BAR_PATTERNS.has(pattern)
        ? THREE_BAR_PATTERN_COUNT
        : TWO_BAR_PATTERN_COUNT;

/**
 * Extracts the last CANDLE_PATTERN_DETECTION_BARS bars from the input array.
 * Shared by prompt construction and chart marker rendering.
 */
export function getDetectionBars(bars: Bar[]): Bar[] {
    return bars.slice(-Math.min(bars.length, CANDLE_PATTERN_DETECTION_BARS));
}

// ─── Detection ───────────────────────────────────────────────────────────────

/**
 * Detects candle patterns from the last N bars.
 * Uses CANDLE_PATTERN_DETECTION_BARS + MULTI_CANDLE_PATTERN_BUFFER bars for detection
 * to ensure 3-bar patterns at the start of the window are correctly detected,
 * but only returns entries for the last CANDLE_PATTERN_DETECTION_BARS bars.
 *
 * Multi-candle patterns take priority: when a multi-candle pattern is detected,
 * all bars involved in that pattern are excluded from single-candle pattern results.
 */
export function detectCandlePatternEntries(bars: Bar[]): CandlePatternEntry[] {
    const extendedCount =
        CANDLE_PATTERN_DETECTION_BARS + MULTI_CANDLE_PATTERN_BUFFER;
    const extendedBars = bars.slice(-extendedCount);
    const detectionStartIndex = Math.max(
        0,
        extendedBars.length - CANDLE_PATTERN_DETECTION_BARS
    );

    // Detect multi-candle patterns and collect involved bar indices
    const multiEntryMap = new Map<
        number,
        { pattern: MultiCandlePattern; involvedIndices: number[] }
    >();

    extendedBars.forEach((_, i) => {
        if (i < detectionStartIndex) return;
        const candleWindow = extendedBars.slice(0, i + 1);
        const detected = detectMultiCandlePattern(candleWindow);
        if (detected === null) return;

        const patternBarCount = getPatternBarCount(detected);
        const startIdx = Math.max(0, i - patternBarCount + 1);
        const involvedIndices = Array.from(
            { length: i - startIdx + 1 },
            (__, offset) => startIdx + offset
        );

        multiEntryMap.set(i, { pattern: detected, involvedIndices });
    });

    // Collect all bar indices involved in any multi-candle pattern
    const multiInvolvedIndices = new Set<number>();
    multiEntryMap.forEach(({ involvedIndices }) => {
        involvedIndices.forEach(idx => multiInvolvedIndices.add(idx));
    });

    // Build multi entries (only for bars in detection window)
    const multiEntries: CandlePatternEntry[] = Array.from(
        multiEntryMap.entries()
    ).map(([i, { pattern }]) => ({
        barIndex: i - detectionStartIndex,
        patternType: 'multi' as const,
        singlePattern: null,
        multiPattern: pattern,
    }));

    // Build single entries (excluding bars involved in multi patterns)
    const detectionBars = extendedBars.slice(detectionStartIndex);
    const singleEntries: CandlePatternEntry[] = detectionBars.reduce<
        CandlePatternEntry[]
    >((acc, bar, i) => {
        const extendedIndex = i + detectionStartIndex;
        if (multiInvolvedIndices.has(extendedIndex)) return acc;
        const pattern = detectCandlePattern(bar);
        if (EXCLUDED_SINGLE_PATTERNS.has(pattern)) return acc;
        return [
            ...acc,
            {
                barIndex: i,
                patternType: 'single' as const,
                singlePattern: pattern,
                multiPattern: null,
            },
        ];
    }, []);

    return [...singleEntries, ...multiEntries].sort(
        (a, b) => a.barIndex - b.barIndex
    );
}

// ─── Selection ──────────────────────────────────────────────────────────────

/**
 * Selects only the last detected candle pattern entries:
 * - If a multi-candle pattern exists: the multi pattern + single patterns for involved bars
 * - If only single patterns exist: only the last single pattern
 *
 * Shared by prompt construction and chart marker rendering.
 */
export function selectLastCandlePatternEntries(
    entries: CandlePatternEntry[],
    detectionBars: Bar[]
): CandlePatternEntry[] {
    if (entries.length === 0) return [];

    const lastMultiEntry = [...entries]
        .reverse()
        .find(e => e.patternType === 'multi');

    if (lastMultiEntry !== undefined) {
        const multiBarIndex = lastMultiEntry.barIndex;
        const startBarIndex = Math.max(
            0,
            multiBarIndex - MULTI_CANDLE_PATTERN_BUFFER
        );
        const involvedIndices = Array.from(
            { length: multiBarIndex - startBarIndex + 1 },
            (_, offset) => startBarIndex + offset
        );

        const involvedSingles = involvedIndices
            .map((idx): SingleCandlePatternEntry | null => {
                const bar = detectionBars[idx];
                const pattern = detectCandlePattern(bar);
                if (EXCLUDED_SINGLE_PATTERNS.has(pattern)) return null;
                return {
                    barIndex: idx,
                    patternType: 'single',
                    singlePattern: pattern,
                    multiPattern: null,
                };
            })
            .filter((e): e is SingleCandlePatternEntry => e !== null);

        return [...involvedSingles, lastMultiEntry].sort(
            (a, b) => a.barIndex - b.barIndex
        );
    }

    // Only single patterns: return the last one
    return [entries[entries.length - 1]];
}
