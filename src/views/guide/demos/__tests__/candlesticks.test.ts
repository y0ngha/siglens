import {
    detectCandlePatternEntries,
    type Bar,
    type CandlePatternEntry,
} from '@y0ngha/siglens-core';
import { describe, expect, it } from 'vitest';
import { CANDLESTICK_DEMOS } from '@/views/guide/demos/candlesticks';

const DETECTION_WINDOW = 15;

interface Expected {
    id: string;
    /** 패턴의 마지막 봉 인덱스 (데모 봉열 기준) */
    at: number;
}

/** slug → 글에서 설명하는 패턴 id(스킬 `gating.triggers`)와 그 패턴이 끝나는 봉. */
const EXPECTED: Record<string, readonly Expected[]> = {
    'abandoned-baby-tri-star': [{ id: 'bullish_abandoned_baby', at: 9 }],
    'advance-block-ladder-bottom': [{ id: 'advance_block', at: 8 }],
    'bearish-engulfing': [{ id: 'bearish_engulfing', at: 9 }],
    'bullish-engulfing': [{ id: 'bullish_engulfing', at: 9 }],
    'counterattack-belt-hold': [
        { id: 'bullish_belt_hold', at: 6 },
        { id: 'bullish_counterattack_line', at: 9 },
    ],
    doji: [
        { id: 'doji', at: 2 },
        { id: 'dragonfly_doji', at: 4 },
        { id: 'gravestone_doji', at: 6 },
    ],
    'gap-continuation': [{ id: 'upside_gap_tasuki', at: 8 }],
    'gap-two-crows-rabbits': [{ id: 'upside_gap_two_crows', at: 8 }],
    'hammer-shooting-star': [
        { id: 'hammer', at: 6 },
        { id: 'shooting_star', at: 13 },
    ],
    harami: [
        { id: 'bullish_harami', at: 6 },
        { id: 'bullish_harami_cross', at: 11 },
    ],
    marubozu: [
        { id: 'bullish_marubozu', at: 2 },
        { id: 'bearish_marubozu', at: 6 },
    ],
    'morning-evening-star': [{ id: 'morning_star', at: 8 }],
    'piercing-dark-cloud': [
        { id: 'piercing_line', at: 6 },
        { id: 'dark_cloud_cover', at: 11 },
    ],
    stomach: [{ id: 'above_the_stomach', at: 9 }],
    'three-inside-outside': [{ id: 'three_inside_up', at: 10 }],
    'three-line-strike': [{ id: 'bearish_three_line_strike', at: 9 }],
    'three-methods': [{ id: 'rising_three_methods', at: 10 }],
    'three-soldiers-crows': [{ id: 'three_white_soldiers', at: 10 }],
    tweezers: [
        { id: 'tweezers_bottom', at: 6 },
        { id: 'tweezers_top', at: 11 },
    ],
};

function toCoreBars(
    bars: readonly {
        time: number;
        open: number;
        high: number;
        low: number;
        close: number;
    }[]
): Bar[] {
    return bars.map(bar => ({ ...bar, volume: 1_000 }));
}

function entryId(entry: CandlePatternEntry): string {
    return entry.patternType === 'multi'
        ? entry.multiPattern
        : entry.singlePattern;
}

describe('candlestick demos', () => {
    for (const [slug, expectations] of Object.entries(EXPECTED)) {
        it(`${slug}: core detects the article's pattern on the marked bars`, () => {
            const demo = CANDLESTICK_DEMOS[slug]();
            const offset = Math.max(0, demo.bars.length - DETECTION_WINDOW);
            const entries = detectCandlePatternEntries(toCoreBars(demo.bars));
            for (const expected of expectations) {
                const found = entries.some(
                    entry =>
                        entry.barIndex + offset === expected.at &&
                        entryId(entry) === expected.id
                );
                expect(
                    found,
                    `${expected.id}@${expected.at} in ${JSON.stringify(entries.map(e => [e.barIndex + offset, entryId(e)]))}`
                ).toBe(true);
                const marked = (demo.overlays ?? []).some(
                    overlay =>
                        overlay.kind === 'marker' && overlay.i === expected.at
                );
                expect(marked, `marker at ${expected.at}`).toBe(true);
            }
        });
    }

    it('spinning-top demo bar has a small body with shadows on both sides', () => {
        const demo = CANDLESTICK_DEMOS.doji();
        const bar = demo.bars[9];
        const range = bar.high - bar.low;
        const body = Math.abs(bar.close - bar.open);
        expect(body / range).toBeLessThanOrEqual(0.4);
        expect(body / range).toBeGreaterThan(0.1);
        expect(bar.high - Math.max(bar.open, bar.close)).toBeGreaterThan(0);
        expect(Math.min(bar.open, bar.close) - bar.low).toBeGreaterThan(0);
    });

    it('every demo is internally consistent OHLC with increasing time', () => {
        for (const [slug, factory] of Object.entries(CANDLESTICK_DEMOS)) {
            const { bars } = factory();
            bars.forEach((bar, index) => {
                expect(
                    bar.high,
                    `${slug}#${index} high`
                ).toBeGreaterThanOrEqual(Math.max(bar.open, bar.close) - 1e-9);
                expect(bar.low, `${slug}#${index} low`).toBeLessThanOrEqual(
                    Math.min(bar.open, bar.close) + 1e-9
                );
                if (index > 0)
                    expect(bar.time).toBeGreaterThan(bars[index - 1].time);
            });
        }
    });
});
