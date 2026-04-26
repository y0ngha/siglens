import type {
    Bar,
    CandlePatternEntry,
    MultiCandlePattern,
} from '@/domain/types';
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

// ─── Helpers ─────────────────────────────────────────────────────────────────

const getPatternBarCount = (pattern: MultiCandlePattern): number =>
    THREE_BAR_PATTERNS.has(pattern)
        ? THREE_BAR_PATTERN_COUNT
        : TWO_BAR_PATTERN_COUNT;

/**
 * Yield merged entries from two sorted CandlePatternEntry arrays in O(n)
 * using a two-pointer approach.
 */
function* mergeSortedGen(
    a: CandlePatternEntry[],
    b: CandlePatternEntry[]
): Generator<CandlePatternEntry> {
    let ai = 0;
    let bi = 0;
    while (ai < a.length && bi < b.length) {
        if (a[ai]!.barIndex <= b[bi]!.barIndex) yield a[ai++]!;
        else yield b[bi++]!;
    }
    while (ai < a.length) yield a[ai++]!;
    while (bi < b.length) yield b[bi++]!;
}

/**
 * Merge two CandlePatternEntry arrays that are already sorted by barIndex
 * into a single sorted array in O(n) using a two-pointer approach.
 */
function mergeSortedEntries(
    a: CandlePatternEntry[],
    b: CandlePatternEntry[]
): CandlePatternEntry[] {
    return [...mergeSortedGen(a, b)];
}

/**
 * Extracts the last CANDLE_PATTERN_DETECTION_BARS bars from the input array.
 * Shared by prompt construction and chart marker rendering.
 */
export function getDetectionBars(bars: Bar[]): Bar[] {
    return bars.slice(-CANDLE_PATTERN_DETECTION_BARS);
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
    const multiEntryMap = extendedBars.reduce<
        Map<number, { pattern: MultiCandlePattern; involvedIndices: number[] }>
    >((acc, _, i) => {
        if (i < detectionStartIndex) return acc;
        const candleWindow = extendedBars.slice(0, i + 1);
        const detected = detectMultiCandlePattern(candleWindow);
        if (detected === null) return acc;

        const patternBarCount = getPatternBarCount(detected);
        const startIdx = Math.max(0, i - patternBarCount + 1);
        const involvedIndices = Array.from(
            { length: i - startIdx + 1 },
            (_, offset) => startIdx + offset
        );

        return new Map([...acc, [i, { pattern: detected, involvedIndices }]]);
    }, new Map());

    // Collect all bar indices involved in any multi-candle pattern
    const multiInvolvedIndices = new Set(
        Array.from(multiEntryMap.values()).flatMap(
            ({ involvedIndices }) => involvedIndices
        )
    );

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

    return mergeSortedEntries(singleEntries, multiEntries);
}

// ─── Selection ──────────────────────────────────────────────────────────────

/**
 * Selects the last detected candle pattern entries:
 * - Returns the last multi-candle pattern (if any) + the last single-candle pattern (if any).
 * - This ensures both pattern types are represented when they co-exist.
 *
 * Shared by prompt construction and chart marker rendering.
 */
export function selectLastCandlePatternEntries(
    entries: CandlePatternEntry[]
): CandlePatternEntry[] {
    if (entries.length === 0) return [];

    const lastMultiEntry = entries.findLast(e => e.patternType === 'multi');
    const lastSingleEntry = entries.findLast(e => e.patternType === 'single');

    const result: CandlePatternEntry[] = [];
    if (lastMultiEntry !== undefined) result.push(lastMultiEntry);
    if (lastSingleEntry !== undefined) result.push(lastSingleEntry);

    return result.sort((a, b) => a.barIndex - b.barIndex);
}
