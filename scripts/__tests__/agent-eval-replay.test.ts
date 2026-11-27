vi.mock('server-only', () => ({}));

/**
 * Unit tests for scripts/agent-eval/replayTools.mjs: the recorded tool results of a saved conversation are turned
 * into the NEW variant's shape by the app's exported enrichment functions. Hand-written fixtures; no network, DB or LLM.
 */
import { describe, expect, it, vi } from 'vitest';

import {
    buildHolderReads,
    chartReferenceFromBarsResult,
    makeReplayExecutor,
    matchRecorded,
    parseRecorded,
} from '../agent-eval/replayTools.mjs';

describe('parseRecorded', () => {
    it('accepts an object or a JSON string, and returns null for a cut string', () => {
        expect(parseRecorded({ a: 1 })).toEqual({ a: 1 });
        expect(parseRecorded('{"a":1}')).toEqual({ a: 1 });
        expect(parseRecorded('{"a":')).toBeNull();
        expect(parseRecorded('"text"')).toBeNull();
    });
});

describe('matchRecorded', () => {
    const recorded = [
        { name: 'get_quote', args: { symbols: ['AAPL'] }, result: {} },
        {
            name: 'get_bars_indicators',
            args: { symbol: 'AAPL', timeframe: '1Day', bars: 30 },
            result: {},
        },
        {
            name: 'get_bars_indicators',
            args: { symbol: 'AAPL', timeframe: '1Day', bars: 30 },
            result: {},
        },
    ];

    it('matches name and all args first, then name+symbol+timeframe, else null', () => {
        expect(
            matchRecorded(recorded, 'get_quote', { symbols: ['AAPL'] })
        ).toEqual({
            index: 0,
            level: 'exact',
        });
        expect(
            matchRecorded(recorded, 'get_bars_indicators', {
                symbol: 'AAPL',
                timeframe: '1Day',
            })
        ).toEqual({ index: 1, level: 'name+symbol+timeframe' });
        expect(
            matchRecorded(recorded, 'get_bars_indicators', {
                symbol: 'AAPL',
                timeframe: '1Week',
            })
        ).toBeNull();
        expect(
            matchRecorded(recorded, 'get_news', { symbol: 'AAPL' })
        ).toBeNull();
    });

    it('does not hand out a used record twice', () => {
        const used = new Set([1]);
        expect(
            matchRecorded(
                recorded,
                'get_bars_indicators',
                { symbol: 'AAPL', timeframe: '1Day', bars: 30 },
                used
            )
        ).toEqual({ index: 2, level: 'exact' });
    });
});

describe('chartReferenceFromBarsResult', () => {
    const bars = {
        timeframe: '1Day',
        derived: {
            range: { high: 130, low: 99 },
            ranges: { '20bars': { high: 128, low: 109 } },
        },
        latest: { ma: { '20': 117.5, '50': 112 } },
    };

    it('reads the printed 52-week and 20-bar range and the averages', () => {
        expect(chartReferenceFromBarsResult(bars)).toEqual({
            high52w: 130,
            low52w: 99,
            high20: 128,
            low20: 109,
            sma20: 117.5,
            sma50: 112,
            sma200: null,
        });
    });

    it('is null for an intraday result, a missing result, or one with no values', () => {
        expect(
            chartReferenceFromBarsResult({ ...bars, timeframe: '1Hour' })
        ).toBeNull();
        expect(chartReferenceFromBarsResult(null)).toBeNull();
        expect(chartReferenceFromBarsResult({ timeframe: '1Day' })).toBeNull();
        // the timeframe must be stated: an unlabelled result is not assumed daily
        expect(
            chartReferenceFromBarsResult({ ...bars, timeframe: undefined })
        ).toBeNull();
    });
});

const holderData = {
    AMD: {
        cusip: 'C1',
        cusipCreatedAt: '2026-01-01T00:00:00Z',
        aggregates: [
            {
                period: '2026-09-30',
                holders: 3,
                shares: 1,
                valueUsd: 1,
                newHolders: 0,
                increased: 0,
                decreased: 0,
                exited: 0,
                netShareChange: 0,
            },
        ],
        filers: [
            { cik: 1, name: 'TWO SIGMA INVESTMENTS LP' },
            { cik: 2, name: 'OTHER FUND INC' },
            { cik: 3, name: 'QUIET CAPITAL LLC' },
            { cik: 4, name: 'LATE FUND LP' },
            { cik: 5, name: 'DODGE & COX' },
        ],
        positions: [
            { cik: 1, period: '2026-09-30', shares: 5000, valueK: 100 },
            { cik: 1, period: '2026-06-30', shares: 4000, valueK: 80 },
            { cik: 2, period: '2026-09-30', shares: 9000, valueK: 200 },
            { cik: 5, period: '2026-09-30', shares: 700, valueK: 10 },
        ],
        filings: [
            {
                cik: 3,
                period: '2026-09-30',
                processed: true,
                universeStamp: '2026-02-01T00:00:00Z',
            },
            {
                cik: 4,
                period: '2026-09-30',
                processed: true,
                universeStamp: '2025-12-01T00:00:00Z',
            },
        ],
    },
};

describe('buildHolderReads', () => {
    const reads = buildHolderReads(holderData);

    it('maps a symbol to its cusip and returns aggregates newest first', async () => {
        expect(await reads.findCusipsBySymbol('AMD')).toEqual(['C1']);
        expect(await reads.findCusipsBySymbol('XXX')).toEqual([]);
        expect(
            (await reads.findAggregates('C1', 8)).map(
                (a: { period: string }) => a.period
            )
        ).toEqual(['2026-09-30']);
        expect(await reads.findLatestPositionPeriod('C1')).toBe('2026-09-30');
    });

    it('finds filers containing every token, shortest name first, within the limit', async () => {
        expect(
            (await reads.findFilersByNameTokens(['FUND'], 50)).map(f => f.cik)
        ).toEqual([4, 2]); // 'LATE FUND LP' is shorter than 'OTHER FUND INC'
        expect(await reads.findFilersByNameTokens(['FUND'], 1)).toHaveLength(1);
    });

    it('positions carry the previous quarter shares and value x1000, largest first', async () => {
        expect(
            await reads.findHolderPositions('C1', '2026-09-30', [1, 2])
        ).toEqual([
            {
                cik: 2,
                filerName: 'OTHER FUND INC',
                shares: 9000,
                valueUsd: 200000,
                prevShares: null,
            },
            {
                cik: 1,
                filerName: 'TWO SIGMA INVESTMENTS LP',
                shares: 5000,
                valueUsd: 100000,
                prevShares: 4000,
            },
        ]);
    });

    it('a filing could list the cusip only when its universe stamp is not before the mapping', async () => {
        expect(
            await reads.findFilerFilings('C1', [3, 4], '2026-09-30')
        ).toEqual([
            { cik: 3, processed: true, couldListCusip: true },
            { cik: 4, processed: true, couldListCusip: false },
        ]);
    });

    it('the AND token stays out of the candidate filter, so a filer with an ampersand is found', async () => {
        expect(
            (
                await reads.findFilersByNameTokens(['DODGE', 'AND', 'COX'], 50)
            ).map((f: { cik: number }) => f.cik)
        ).toEqual([5]);
        expect(await reads.findFilersByNameTokens(['AND'], 50)).toEqual([]);
    });

    it('counts holders with more shares', async () => {
        expect(await reads.countHoldersAbove('C1', '2026-09-30', 5000)).toBe(1);
    });
});

describe('makeReplayExecutor', () => {
    const recorded = [
        {
            name: 'get_fundamentals',
            args: { symbol: 'AMD' },
            result: JSON.stringify({
                symbol: 'AMD',
                earningsReactions: [
                    { date: '2026-02-03', movePct: 6.05 },
                    { date: '2025-07-29', movePct: -4.5 },
                ],
            }),
        },
        {
            name: 'get_options_summary',
            args: { symbol: 'AMD' },
            result: { metrics: { putCallRatio: 0.83 } },
        },
        {
            name: 'get_bars_indicators',
            args: { symbol: 'AMD', timeframe: '1Day' },
            result: {
                symbol: 'AMD',
                timeframe: '1Day',
                derived: { range: { high: 140, low: 99 } },
                latest: { ma: {} },
            },
        },
        {
            name: 'get_cached_analysis',
            args: { symbol: 'AMD', tab: 'technical' },
            result: {
                timeframe: '1Day',
                analysis: {
                    keyLevels: {
                        support: [{ price: 110, reason: 'r' }],
                        resistance: [{ price: 130, reason: 'r' }],
                    },
                    priceTargets: null,
                    actionRecommendation: null,
                },
                sinceAnalysis: {
                    priceNow: 120,
                    nearestSupport: { price: 110, distancePct: -8.33 },
                    nearestResistance: { price: 130, distancePct: 8.33 },
                },
            },
        },
        {
            name: 'get_investor_flows',
            args: { symbol: 'AMD', holder: 'Two Sigma' },
            result: {
                institutional: {
                    putCall: {
                        period: '2026-06-30',
                        putCallValueRatio: 1.42,
                        priorPutCallValueRatio: 0.75,
                        note: 'n',
                    },
                },
            },
        },
        { name: 'get_quote', args: { symbols: ['AMD'] }, result: '{"cut":' },
    ];
    const caseRecord = { id: 'c1', recorded };
    const options = { holderData, today: '2026-11-21' };

    it('OLD returns every recorded result unchanged', async () => {
        const { execute } = makeReplayExecutor(caseRecord, {
            ...options,
            variant: 'old',
        });
        expect(await execute('get_options_summary', { symbol: 'AMD' })).toEqual(
            {
                metrics: { putCallRatio: 0.83 },
            }
        );
    });

    it('NEW adds the earnings tally right after earningsReactions', async () => {
        const { execute } = makeReplayExecutor(caseRecord, {
            ...options,
            variant: 'new',
        });
        const result = (await execute('get_fundamentals', {
            symbol: 'AMD',
        })) as Record<string, unknown>;
        expect(Object.keys(result)).toEqual([
            'symbol',
            'earningsReactions',
            'earningsReactionTally',
        ]);
        expect(result.earningsReactionTally).toMatchObject({
            measured: 2,
            up: 1,
            down: 1,
        });
    });

    it('NEW adds the options put/call reading', async () => {
        const { execute } = makeReplayExecutor(caseRecord, {
            ...options,
            variant: 'new',
        });
        expect(
            await execute('get_options_summary', { symbol: 'AMD' })
        ).toMatchObject({
            metrics: {
                putCallRatio: 0.83,
                putCallReading: { side: 'more_calls' },
            },
        });
    });

    it('NEW replaces the nearest pair with a ladder that includes the chart references of the recorded bars result', async () => {
        const { execute } = makeReplayExecutor(caseRecord, {
            ...options,
            variant: 'new',
        });
        const result = (await execute('get_cached_analysis', {
            symbol: 'AMD',
            tab: 'technical',
        })) as {
            sinceAnalysis: Record<string, unknown> & {
                levelLadder: {
                    above: Array<{ price: number }>;
                    below: Array<{ price: number }>;
                };
            };
        };
        expect(result.sinceAnalysis).not.toHaveProperty('nearestSupport');
        expect(
            result.sinceAnalysis.levelLadder.above.map(l => l.price)
        ).toEqual([130, 140]);
        expect(
            result.sinceAnalysis.levelLadder.below.map(l => l.price)
        ).toEqual([110, 99]);
    });

    it('NEW adds the 13F reading and the holder lookup over the supplied rows', async () => {
        const { execute } = makeReplayExecutor(caseRecord, {
            ...options,
            variant: 'new',
        });
        const result = (await execute('get_investor_flows', {
            symbol: 'AMD',
            holder: 'Two Sigma',
        })) as {
            institutional: { putCall: Record<string, unknown> };
            holderLookup: {
                status: string;
                period: string;
                matches: Array<Record<string, unknown>>;
            };
        };
        expect(Object.keys(result.institutional.putCall)).toEqual([
            'period',
            'putCallValueRatio',
            'priorPutCallValueRatio',
            'reading',
            'note',
        ]);
        expect(result.institutional.putCall.reading).toMatchObject({
            side: 'more_puts',
        });
        expect(result.holderLookup).toMatchObject({
            status: 'found',
            period: '2026-09-30',
            matches: [
                {
                    shares: 5000,
                    prevShares: 4000,
                    valueUsd: 100000,
                    rankByShares: 2,
                },
            ],
        });
    });

    it('the holder lookup finds an ampersand filer through the production name matching', async () => {
        const run = makeReplayExecutor(
            {
                id: 'c',
                recorded: [
                    {
                        name: 'get_investor_flows',
                        args: { symbol: 'AMD', holder: 'Dodge & Cox' },
                        result: {},
                    },
                ],
            },
            { ...options, variant: 'new' }
        );
        expect(
            await run.execute('get_investor_flows', {
                symbol: 'AMD',
                holder: 'Dodge & Cox',
            })
        ).toMatchObject({
            holderLookup: { status: 'found', matches: [{ shares: 700 }] },
        });
    });

    it('the holder lookup uses the quarter the recorded holder list names', async () => {
        const run = makeReplayExecutor(
            {
                id: 'c',
                recorded: [
                    {
                        name: 'get_investor_flows',
                        args: { symbol: 'AMD', holder: 'Two Sigma' },
                        result: {
                            institutional: { topHoldersPeriod: '2026-06-30' },
                        },
                    },
                ],
            },
            { ...options, variant: 'new' }
        );
        const result = (await run.execute('get_investor_flows', {
            symbol: 'AMD',
            holder: 'Two Sigma',
        })) as {
            holderLookup: { period: string; matches: { shares: number }[] };
        };
        // 2026-06-30 is the quarter of the list, not the newest complete one (2026-09-30)
        expect(result.holderLookup.period).toBe('2026-06-30');
        expect(result.holderLookup.matches).toMatchObject([{ shares: 4000 }]);
    });

    it('chart references are added only to a daily analysis', async () => {
        const intraday = {
            id: 'c',
            recorded: recorded.map(r =>
                r.name === 'get_cached_analysis'
                    ? {
                          ...r,
                          result: {
                              ...(r.result as object),
                              timeframe: '1Hour',
                          },
                      }
                    : r
            ),
        };
        const run = makeReplayExecutor(intraday, {
            ...options,
            variant: 'new',
        });
        const result = (await run.execute('get_cached_analysis', {
            symbol: 'AMD',
            tab: 'technical',
        })) as {
            sinceAnalysis: { levelLadder: { above: { price: number }[] } };
        };
        expect(
            result.sinceAnalysis.levelLadder.above.map(l => l.price)
        ).toEqual([130]);
    });

    it('no holderLookup without a holder argument or without holder rows', async () => {
        const withoutHolder = makeReplayExecutor(
            {
                id: 'c',
                recorded: [
                    {
                        name: 'get_investor_flows',
                        args: { symbol: 'AMD' },
                        result: {},
                    },
                ],
            },
            { ...options, variant: 'new' }
        );
        expect(
            await withoutHolder.execute('get_investor_flows', { symbol: 'AMD' })
        ).not.toHaveProperty('holderLookup');
        const withoutRows = makeReplayExecutor(caseRecord, {
            holderData: {},
            today: '2026-11-21',
            variant: 'new',
        });
        expect(
            await withoutRows.execute('get_investor_flows', {
                symbol: 'AMD',
                holder: 'Two Sigma',
            })
        ).not.toHaveProperty('holderLookup');
    });

    it('a call with no recorded result is a replay_miss and is counted', async () => {
        const run = makeReplayExecutor(caseRecord, {
            ...options,
            variant: 'new',
        });
        expect(await run.execute('get_news', { symbol: 'AMD' })).toEqual({
            error: 'replay_miss',
        });
        expect(run.misses).toEqual([
            { name: 'get_news', args: { symbol: 'AMD' } },
        ]);
    });

    it('a cut recorded result is returned as is, not enriched', async () => {
        const run = makeReplayExecutor(caseRecord, {
            ...options,
            variant: 'new',
        });
        expect(await run.execute('get_quote', { symbols: ['AMD'] })).toBe(
            '{"cut":'
        );
    });

    it('misses and matches accumulate without mutating earlier snapshots', async () => {
        const run = makeReplayExecutor(caseRecord, {
            ...options,
            variant: 'old',
        });
        const before = run.misses;
        await run.execute('get_news', { symbol: 'AMD' });
        expect(before).toEqual([]);
        expect(run.misses).toHaveLength(1);
    });

    it('records how each call matched', async () => {
        const run = makeReplayExecutor(caseRecord, {
            ...options,
            variant: 'old',
        });
        await run.execute('get_quote', { symbols: ['AMD'] });
        expect(run.matches).toEqual([{ name: 'get_quote', level: 'exact' }]);
    });
});
