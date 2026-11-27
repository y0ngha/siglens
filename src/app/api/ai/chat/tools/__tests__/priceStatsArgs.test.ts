import { AGENT_TOOL_SPECS } from '@y0ngha/siglens-core';
import { describe, expect, it } from 'vitest';
import {
    PRICE_STATS_YEAR_MAX,
    PRICE_STATS_YEAR_MIN,
    parsePriceStatsArgs,
    type ParsedPriceStatsArgs,
    type PriceStatsInvalidArgs,
} from '@/app/api/ai/chat/tools/priceStatsArgs';

const ok = (args: Record<string, unknown>): ParsedPriceStatsArgs => {
    const parsed = parsePriceStatsArgs(args);
    if ('error' in parsed) throw new Error(JSON.stringify(parsed));
    return parsed;
};
const bad = (args: Record<string, unknown>): PriceStatsInvalidArgs => {
    const parsed = parsePriceStatsArgs(args);
    if (!('error' in parsed)) throw new Error('expected invalid_args');
    return parsed;
};

describe('parsePriceStatsArgs — invalid arguments', () => {
    it.each([
        ['no subject', {}, 'subjects'],
        ['empty symbols and no index', { symbols: [] }, 'subjects'],
        ['four symbols', { symbols: ['A', 'B', 'C', 'D'] }, 'subjects'],
        [
            'index plus three symbols',
            { symbols: ['A', 'B', 'C'], index: 'kospi' },
            'subjects',
        ],
        ['symbols not an array', { symbols: 'AAPL' }, 'symbols'],
        ['symbols with a non-string', { symbols: ['AAPL', 3] }, 'symbols'],
        ['symbols with an empty string', { symbols: [' '] }, 'symbols'],
        ['unknown index', { index: 'dow' }, 'index'],
        ['unknown period', { symbols: ['A'], period: '2y' }, 'period'],
        ['year below the range', { symbols: ['A'], year: 1970 }, 'year'],
        ['year above the range', { symbols: ['A'], year: 2101 }, 'year'],
        ['fractional year', { symbols: ['A'], year: 2025.5 }, 'year'],
        ['string year', { symbols: ['A'], year: '2025' }, 'year'],
        ['from not a date', { symbols: ['A'], from: '2026-02-30' }, 'from'],
        ['from not a string', { symbols: ['A'], from: 20260101 }, 'from'],
        [
            'to not a date',
            { symbols: ['A'], from: '2026-01-01', to: '2026-13-01' },
            'to',
        ],
        ['to without from', { symbols: ['A'], to: '2026-01-01' }, 'to'],
        [
            'from after to',
            { symbols: ['A'], from: '2026-05-01', to: '2026-04-01' },
            'from',
        ],
        [
            'dates not an array',
            { symbols: ['A'], dates: '2026-01-02' },
            'dates',
        ],
        ['a non-ISO date', { symbols: ['A'], dates: ['2026-1-5'] }, 'dates'],
        [
            'six distinct dates',
            {
                symbols: ['A'],
                dates: [
                    '2026-01-02',
                    '2026-01-05',
                    '2026-01-06',
                    '2026-01-07',
                    '2026-01-08',
                    '2026-01-09',
                ],
            },
            'dates',
        ],
    ])('%s is rejected naming %s', (_name, args, argument) => {
        const result = bad(args);
        expect(result).toMatchObject({ error: 'invalid_args', argument });
        expect(result.reason.length).toBeGreaterThan(0);
    });
});

describe('parsePriceStatsArgs — accepted shapes', () => {
    it('uppercases and de-duplicates symbols and keeps the input order', () => {
        expect(ok({ symbols: ['nvda', 'AMD', ' nvda '] }).symbols).toEqual([
            'NVDA',
            'AMD',
        ]);
    });

    it('counts a repeated symbol once toward the subject limit', () => {
        expect(
            ok({ symbols: ['A', 'a', 'B', 'C'], index: undefined }).symbols
        ).toEqual(['A', 'B', 'C']);
    });

    it('accepts an index alone and with two symbols', () => {
        expect(ok({ index: 'kospi' })).toMatchObject({
            symbols: [],
            index: 'kospi',
        });
        expect(ok({ symbols: ['A', 'B'], index: 'sp500' }).index).toBe('sp500');
    });

    it('no window and no dates is the default 1y period', () => {
        expect(ok({ symbols: ['A'] }).request).toEqual({
            window: { kind: 'period', period: '1y' },
            dates: [],
            ignored: [],
        });
    });

    it('only dates is the none window', () => {
        expect(
            ok({ symbols: ['A'], dates: ['2026-07-03', '2026-07-03'] }).request
        ).toEqual({
            window: { kind: 'none' },
            dates: ['2026-07-03'],
            ignored: [],
        });
    });

    it('de-duplicates dates before the count limit', () => {
        const same = Array.from({ length: 8 }, () => '2026-07-03');
        expect(ok({ symbols: ['A'], dates: same }).request.dates).toEqual([
            '2026-07-03',
        ]);
    });

    it('dates beside a window keep the window', () => {
        expect(
            ok({ symbols: ['A'], period: '3m', dates: ['2026-07-03'] }).request
        ).toMatchObject({
            window: { kind: 'period', period: '3m' },
            dates: ['2026-07-03'],
        });
    });

    it('year and range windows', () => {
        expect(ok({ symbols: ['A'], year: 2022 }).request.window).toEqual({
            kind: 'year',
            year: 2022,
        });
        expect(
            ok({ symbols: ['A'], from: '2026-03-02' }).request.window
        ).toEqual({ kind: 'range', from: '2026-03-02', to: null });
        expect(
            ok({ symbols: ['A'], from: '2026-03-02', to: '2026-03-02' }).request
                .window
        ).toEqual({ kind: 'range', from: '2026-03-02', to: '2026-03-02' });
    });

    it('from beats year beats period, and the overridden ones are listed', () => {
        expect(
            ok({
                symbols: ['A'],
                from: '2026-03-02',
                year: 2022,
                period: 'ytd',
            }).request
        ).toMatchObject({
            window: { kind: 'range', from: '2026-03-02', to: null },
            ignored: ['year', 'period'],
        });
        expect(
            ok({ symbols: ['A'], year: 2022, period: 'ytd' }).request
        ).toMatchObject({
            window: { kind: 'year', year: 2022 },
            ignored: ['period'],
        });
        expect(
            ok({ symbols: ['A'], from: '2026-03-02', period: '1y' }).request
                .ignored
        ).toEqual(['period']);
        expect(
            ok({ symbols: ['A'], from: '2026-03-02', year: 2022 }).request
                .ignored
        ).toEqual(['year']);
    });
});

describe('year bounds', () => {
    it('equal the get_price_stats spec minimum and maximum', () => {
        const year = AGENT_TOOL_SPECS.find(
            spec => spec.name === 'get_price_stats'
        )?.inputSchema.properties.year;
        expect(year).toMatchObject({
            minimum: PRICE_STATS_YEAR_MIN,
            maximum: PRICE_STATS_YEAR_MAX,
        });
    });
});
