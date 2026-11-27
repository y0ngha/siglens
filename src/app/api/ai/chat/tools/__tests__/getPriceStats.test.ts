vi.mock('server-only', () => ({}));

const { loaders, asset, core, seen } = vi.hoisted(() => ({
    loaders: { symbol: vi.fn(), index: vi.fn() },
    asset: { info: vi.fn() },
    core: { compute: vi.fn() },
    seen: {
        inputs: [] as {
            symbol: string;
            fmpSymbol?: string;
            profile: string;
            assetKnown: boolean;
            earliestFor: (lastCloseDate: string) => string | null;
        }[],
        indexCalls: [] as string[],
    },
}));
vi.mock('@/entities/bars/server/loadPriceStatsCloses', () => ({
    loadPriceStatsCloses: loaders.symbol,
    loadIndexPriceStatsCloses: loaders.index,
}));
vi.mock('@/entities/ticker/server/resolveAssetInfo', async () => {
    const actual = await vi.importActual<
        typeof import('@/entities/ticker/server/resolveAssetInfo')
    >('@/entities/ticker/server/resolveAssetInfo');
    return {
        ...actual,
        // A rejected lookup is a failure (`lookupFailed`); a resolved null is a definite "unknown symbol".
        resolveAssetLookup: async (symbol: string) =>
            asset.info(symbol).then(
                (found: unknown) => ({ asset: found, lookupFailed: false }),
                () => ({ asset: null, lookupFailed: true })
            ),
    };
});
vi.mock('@y0ngha/siglens-core', async importOriginal => {
    const actual =
        await importOriginal<typeof import('@y0ngha/siglens-core')>();
    core.compute.mockImplementation(actual.computePriceStats);
    return { ...actual, computePriceStats: core.compute };
});

import {
    AGENT_PRICE_STATS_MAX_DATES,
    PRICE_STATS_NOTE_TEMPLATES,
    type MarketDailyClose,
} from '@y0ngha/siglens-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { calendarChangeView } from '@/app/api/ai/chat/tools/calendarChange';
import { getPriceStatsTool } from '@/app/api/ai/chat/tools/getPriceStats';
import {
    PRICE_STATS_RESULT_MAX_CHARS,
    truncateToolResult,
} from '@/app/api/ai/chat/tools/truncate';
import { isRecord } from '@/shared/lib/isRecord';

const ctx = {
    userId: 'u',
    tier: 'member' as const,
    locale: 'ko' as const,
    signal: new AbortController().signal,
};
const rt = {
    analysisModel: 'deepseek-v4.1-flash' as const,
    ensureSymbolData: async (): Promise<void> => {},
};
const run = (args: Record<string, unknown>) => getPriceStatsTool(args, ctx, rt);

/** 2026-11-20(금) 10:00 ET = 2026-11-21(토) 00:00 KST: 미국은 11-20, 한국은 11-21이다. */
const NOW = new Date('2026-11-20T15:00:00Z');

/** 평일만 있는 일봉 종가: `from`부터 `to`까지, 종가는 100 + 평일 순번. */
function weekdayCloses(from: string, to: string): MarketDailyClose[] {
    const start = Date.parse(`${from}T00:00:00Z`);
    const days = Math.round(
        (Date.parse(`${to}T00:00:00Z`) - start) / 86_400_000
    );
    return Array.from({ length: days + 1 }, (_, i) =>
        new Date(start + i * 86_400_000).toISOString().slice(0, 10)
    )
        .filter(
            date => ![0, 6].includes(new Date(`${date}T00:00:00Z`).getUTCDay())
        )
        .map((date, i) => ({ date, close: 100 + i }));
}

const US_CLOSES = weekdayCloses('2024-01-01', '2026-11-19');
const loaded = (
    closes: MarketDailyClose[],
    over: Record<string, unknown> = {}
) => ({
    closes,
    source: 'five_year_cache' as const,
    sessionInProgress: false,
    ...over,
});

const subjectsOf = (result: unknown): Record<string, unknown>[] => {
    if (!isRecord(result) || !Array.isArray(result.subjects))
        throw new Error(`no subjects: ${JSON.stringify(result)}`);
    return result.subjects.filter(isRecord);
};

beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    core.compute.mockClear();
    loaders.symbol.mockReset();
    loaders.index.mockReset();
    asset.info.mockReset();
    seen.inputs = [];
    seen.indexCalls = [];
    loaders.symbol.mockImplementation(
        async (input: (typeof seen.inputs)[number]) => {
            seen.inputs = [...seen.inputs, input];
            return loaded(US_CLOSES);
        }
    );
    loaders.index.mockImplementation(async (index: string) => {
        seen.indexCalls = [...seen.indexCalls, index];
        return loaded(US_CLOSES, { source: 'full_history' });
    });
    asset.info.mockImplementation(async (symbol: string) => ({
        symbol,
        name: `${symbol} Inc`,
    }));
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

describe('getPriceStatsTool — arguments', () => {
    it.each([
        [{}, 'subjects'],
        [{ symbols: ['A', 'B', 'C'], index: 'kospi' }, 'subjects'],
        [{ symbols: ['AAPL'], period: 'week' }, 'period'],
        [{ symbols: ['AAPL'], to: '2026-01-01' }, 'to'],
    ])(
        '%o is rejected naming %s and nothing is loaded',
        async (args, argument) => {
            await expect(run(args)).resolves.toMatchObject({
                error: 'invalid_args',
                argument,
            });
            expect(loaders.symbol).not.toHaveBeenCalled();
            expect(loaders.index).not.toHaveBeenCalled();
        }
    );

    it(`rejects more than ${AGENT_PRICE_STATS_MAX_DATES} dates without cutting`, async () => {
        const dates = Array.from(
            { length: AGENT_PRICE_STATS_MAX_DATES + 1 },
            (_, i) => `2026-07-0${i + 1}`
        );
        await expect(run({ symbols: ['AAPL'], dates })).resolves.toMatchObject({
            error: 'invalid_args',
            argument: 'dates',
        });
    });

    it('rejects a year after the current year in the subject market, and accepts the current one', async () => {
        await expect(
            run({ symbols: ['AAPL'], year: 2027 })
        ).resolves.toMatchObject({ error: 'invalid_args', argument: 'year' });
        expect(loaders.symbol).not.toHaveBeenCalled();
        const ok = await run({ symbols: ['AAPL'], year: 2026 });
        expect(subjectsOf(ok)[0]).toMatchObject({ subject: 'AAPL' });
    });

    it('rejects a year that has not started for even one of the subjects', async () => {
        // 2026-12-31 23:00 ET is already 2027-01-01 in Seoul: the KR subject is in 2027, the US one is not.
        vi.setSystemTime(new Date('2027-01-01T04:00:00Z'));
        // US: 2026-12-31 23:00 ET (year 2026), KR: 2027-01-01 13:00 KST (year 2027)
        asset.info.mockImplementation(async (symbol: string) => ({
            symbol,
            name: symbol,
            ...(symbol.endsWith('.KS') ? { marketProfile: 'kr-equity' } : {}),
        }));
        await expect(
            run({ symbols: ['AAPL', '005930.KS'], year: 2027 })
        ).resolves.toMatchObject({
            error: 'invalid_args',
            argument: 'year',
            reason: expect.stringContaining('AAPL'),
        });
    });

    it('rejects a from date after the subject market date', async () => {
        await expect(
            run({ symbols: ['AAPL'], from: '2026-11-21' })
        ).resolves.toMatchObject({ error: 'invalid_args', argument: 'from' });
        const ok = await run({ symbols: ['AAPL'], from: '2026-11-20' });
        expect(subjectsOf(ok)[0]).toMatchObject({ subject: 'AAPL' });
    });
});

describe('getPriceStatsTool — summer time (EDT)', () => {
    // 2026-07-06 02:00 UTC = 2026-07-05 22:00 EDT (Sunday) = 2026-07-06 11:00 KST (Monday).
    const EDT = new Date('2026-07-06T02:00:00Z');
    beforeEach(() => {
        vi.setSystemTime(EDT);
        asset.info.mockImplementation(async (symbol: string) => ({
            symbol,
            name: symbol,
            ...(symbol === '005930.KS' ? { marketProfile: 'kr-equity' } : {}),
        }));
    });

    it('passes each subject its own market date: US 07-05, KR 07-06', async () => {
        await run({ symbols: ['AAPL', '005930.KS'], period: 'ytd' });
        expect(core.compute).toHaveBeenCalledWith(
            [
                expect.objectContaining({ label: 'AAPL', today: '2026-07-05' }),
                expect.objectContaining({
                    label: '005930.KS',
                    today: '2026-07-06',
                }),
            ],
            expect.anything()
        );
    });

    it('rejects a from date the US market has not reached (07-06) but accepts its own date (07-05)', async () => {
        await expect(
            run({
                symbols: ['AAPL', '005930.KS'],
                from: '2026-07-06',
            })
        ).resolves.toMatchObject({
            error: 'invalid_args',
            argument: 'from',
            reason: expect.stringContaining('AAPL'),
        });
        const ok = await run({
            symbols: ['AAPL', '005930.KS'],
            from: '2026-07-05',
        });
        expect(subjectsOf(ok).map(s => s.subject)).toEqual([
            'AAPL',
            '005930.KS',
        ]);
    });

    it('rejects a year only when it is after the current year in some subject market', async () => {
        await expect(
            run({ symbols: ['AAPL'], year: 2027 })
        ).resolves.toMatchObject({ error: 'invalid_args', argument: 'year' });
        const ok = await run({ symbols: ['AAPL', '005930.KS'], year: 2026 });
        expect(subjectsOf(ok)).toHaveLength(2);
    });
});

describe('getPriceStatsTool — result', () => {
    it('adds the source, currency and resolved instrument to core statistics', async () => {
        asset.info.mockResolvedValue({
            symbol: 'BRK.B',
            name: 'Berkshire Hathaway',
            fmpSymbol: 'BRK-B',
        });
        const result = await run({ symbols: ['brk.b'], period: '1m' });
        expect(result).toMatchObject({
            source: 'SIGLENS daily closes (price only, split-adjusted, dividends excluded)',
            asOf: '2026-11-19',
        });
        expect(subjectsOf(result)[0]).toMatchObject({
            subject: 'BRK.B',
            currency: 'USD',
            resolvedName: 'Berkshire Hathaway',
            resolvedSymbol: 'BRK-B',
            window: { endDate: '2026-11-19' },
        });
        expect(seen.inputs).toEqual([
            expect.objectContaining({
                symbol: 'BRK.B',
                fmpSymbol: 'BRK-B',
                profile: 'us-equity',
            }),
        ]);
    });

    it('passes the per-subject market date and market id to core and the notes through verbatim', async () => {
        asset.info.mockImplementation(async (symbol: string) => ({
            symbol,
            name: symbol,
            ...(symbol === '005930.KS' ? { marketProfile: 'kr-equity' } : {}),
        }));
        const krCloses = weekdayCloses('2024-01-01', '2026-11-20');
        loaders.symbol.mockImplementation(
            async (input: (typeof seen.inputs)[number]) =>
                loaded(input.profile === 'kr-equity' ? krCloses : US_CLOSES)
        );
        const result = await run({
            symbols: ['AAPL', '005930.KS'],
            period: '1y',
        });
        expect(core.compute).toHaveBeenCalledTimes(1);
        expect(core.compute).toHaveBeenCalledWith(
            [
                expect.objectContaining({
                    label: 'AAPL',
                    market: 'us',
                    today: '2026-11-20',
                    alwaysOpen: false,
                }),
                expect.objectContaining({
                    label: '005930.KS',
                    market: 'kr',
                    today: '2026-11-21',
                }),
            ],
            expect.anything()
        );
        expect(subjectsOf(result)[1]).toMatchObject({ currency: 'KRW' });
        expect(result).toMatchObject({
            notes: expect.arrayContaining([
                PRICE_STATS_NOTE_TEMPLATES.endsDiffer(
                    'AAPL',
                    '2026-11-19',
                    '005930.KS',
                    '2026-11-20'
                ),
            ]),
        });
    });

    it('crypto is always open and anchored on the UTC date', async () => {
        asset.info.mockResolvedValue({
            symbol: 'BTCUSD',
            name: 'Bitcoin',
            marketProfile: 'crypto',
        });
        await run({ symbols: ['BTCUSD'] });
        expect(core.compute).toHaveBeenCalledWith(
            [
                expect.objectContaining({
                    market: 'crypto',
                    alwaysOpen: true,
                    today: '2026-11-20',
                }),
            ],
            expect.anything()
        );
    });

    it('forwards the sessionInProgress flag the loader reports', async () => {
        loaders.symbol.mockResolvedValue(
            loaded(US_CLOSES, { sessionInProgress: true })
        );
        const result = await run({ symbols: ['AAPL'] });
        expect(core.compute).toHaveBeenCalledWith(
            [expect.objectContaining({ sessionInProgress: true })],
            expect.anything()
        );
        expect(result).toMatchObject({
            notes: [
                PRICE_STATS_NOTE_TEMPLATES.sessionInProgress(
                    'AAPL',
                    '2026-11-19'
                ),
            ],
        });
    });

    it('passes loaded rows to core as loaded, including an unusable price', async () => {
        const closes = [
            ...US_CLOSES.slice(0, -1),
            { date: '2026-11-19', close: 0 },
        ];
        loaders.symbol.mockResolvedValue(loaded(closes));
        await run({ symbols: ['AAPL'] });
        // Identity, not a copy: `find` by the closes array the loader returned.
        expect(
            core.compute.mock.calls.find(
                ([subjects]) => subjects[0]?.closes === closes
            )
        ).toBeDefined();
    });

    it('dates-only questions return the date lookups with no window figures', async () => {
        const result = await run({
            symbols: ['AAPL'],
            dates: ['2026-07-04', '2026-07-03'],
        });
        expect(subjectsOf(result)[0]).toMatchObject({
            window: null,
            closes: [
                { requestedDate: '2026-07-04', status: 'previous_session' },
                { requestedDate: '2026-07-03', status: 'exact' },
            ],
        });
    });
});

describe('getPriceStatsTool — data path', () => {
    it('tells the loader the earliest date from the series actual last close and the subject market date', async () => {
        await run({ symbols: ['AAPL'], period: 'ytd' });
        const input = seen.inputs.find(i => i.symbol === 'AAPL');
        if (input === undefined) throw new Error('loader not called');
        expect(input.earliestFor('2026-11-19')).toBe('2025-12-31');
        expect(input.earliestFor('2026-11-10')).toBe('2025-12-31');
    });

    it('is the whole history for max and a month back for 1m', async () => {
        await run({ symbols: ['AAPL'], period: 'max' });
        await run({ symbols: ['MSFT'], period: '1m' });
        const max = seen.inputs.find(i => i.symbol === 'AAPL');
        const month = seen.inputs.find(i => i.symbol === 'MSFT');
        expect(max?.earliestFor('2026-11-19')).toBeNull();
        expect(month?.earliestFor('2026-11-19')).toBe('2026-10-19');
    });

    it('a requested date earlier than the window start moves the earliest date back', async () => {
        await run({ symbols: ['AAPL'], period: '1m', dates: ['2025-03-03'] });
        const input = seen.inputs.find(i => i.symbol === 'AAPL');
        expect(input?.earliestFor('2026-11-19')).toBe('2025-03-03');
    });

    it('index subjects load through the index loader only, labelled by the index key', async () => {
        const result = await run({ index: 'kospi', period: 'ytd' });
        expect(seen.indexCalls).toEqual(['kospi']);
        expect(loaders.symbol).not.toHaveBeenCalled();
        expect(subjectsOf(result)[0]).toMatchObject({
            subject: 'kospi',
            name: 'KOSPI',
            // Index levels are points, not money.
            currency: null,
        });
        expect(core.compute).toHaveBeenCalledWith(
            [expect.objectContaining({ market: 'kr', today: '2026-11-21' })],
            expect.anything()
        );
    });

    it('index closes the loader rounded to 2 decimals show up as 2 decimals in the figures and summary', async () => {
        // The loader rounds index closes; core prints them as given, so the summary carries the same 2-decimal levels.
        loaders.index.mockResolvedValue(
            loaded(
                [
                    { date: '2026-10-19', close: 4214.17 },
                    { date: '2026-11-19', close: 4399.83 },
                ],
                { source: 'full_history' }
            )
        );
        const result = await run({ index: 'sp500', period: '1m' });
        const subject = subjectsOf(result)[0];
        expect(subject).toMatchObject({
            window: { baseClose: 4214.17, endClose: 4399.83 },
            returnPct: 4.41,
        });
        expect(subject?.summary).toContain('4214.17');
        expect(subject?.summary).toContain('4399.83');
        expect(JSON.stringify(subject)).not.toMatch(/\d+\.\d{3,}/);
    });

    it('a symbol and an index compare in one call with one correlation pair', async () => {
        const result = await run({ symbols: ['AAPL'], index: 'sp500' });
        expect(result).toMatchObject({
            correlation: [{ subjects: ['AAPL', 'sp500'] }],
        });
        expect(subjectsOf(result)[1]).toMatchObject({ name: 'S&P 500' });
    });

    it('a definite unknown symbol (lookup succeeded with null) is assetKnown false, a recognised one true', async () => {
        asset.info.mockImplementation(async (symbol: string) =>
            symbol === 'TYPO' ? null : { symbol, name: symbol }
        );
        await run({ symbols: ['AAPL', 'TYPO'] });
        expect(seen.inputs.find(i => i.symbol === 'AAPL')?.assetKnown).toBe(
            true
        );
        expect(seen.inputs.find(i => i.symbol === 'TYPO')?.assetKnown).toBe(
            false
        );
    });

    it('a lookup that threw is not a definite unknown: the loader keeps the old path (assetKnown true)', async () => {
        asset.info.mockRejectedValue(new Error('db down'));
        await run({ symbols: ['AAPL'] });
        expect(seen.inputs.find(i => i.symbol === 'AAPL')?.assetKnown).toBe(
            true
        );
    });

    it('falls back to the symbol shape for the market when the asset lookup failed', async () => {
        asset.info.mockResolvedValue(null);
        const result = await run({ symbols: ['005930.KS'] });
        expect(seen.inputs).toEqual([
            expect.objectContaining({
                symbol: '005930.KS',
                profile: 'kr-equity',
            }),
        ]);
        expect(subjectsOf(result)[0]).toMatchObject({
            subject: '005930.KS',
            currency: 'KRW',
        });
        expect(subjectsOf(result)[0]).not.toHaveProperty('resolvedName');
    });
});

describe('getPriceStatsTool — failed subjects', () => {
    it('keeps each failure at its input position and computes the rest', async () => {
        loaders.symbol.mockImplementation(
            async (input: (typeof seen.inputs)[number]) => {
                if (input.symbol === 'ZZZ') return null;
                if (input.symbol === 'BAD') throw new Error('fmp down');
                return loaded(US_CLOSES);
            }
        );
        const result = await run({ symbols: ['ZZZ', 'BAD', 'AAPL'] });
        const subjects = subjectsOf(result);
        expect(subjects.map(s => s.subject)).toEqual(['ZZZ', 'BAD', 'AAPL']);
        expect(subjects[0]).toEqual({ subject: 'ZZZ', found: false });
        expect(subjects[1]).toEqual({
            subject: 'BAD',
            available: false,
            reason: 'provider_failed',
        });
        expect(subjects[2]).toHaveProperty('returnPct');
    });

    it('a single computed subject among failures has no correlation', async () => {
        loaders.symbol.mockImplementation(
            async (input: (typeof seen.inputs)[number]) =>
                input.symbol === 'ZZZ' ? null : loaded(US_CLOSES)
        );
        const result = await run({ symbols: ['ZZZ', 'AAPL'] });
        expect(result).not.toHaveProperty('correlation');
    });

    it('logs a provider failure without the error object', async () => {
        loaders.symbol.mockRejectedValue(new Error('secret message'));
        await run({ symbols: ['AAPL'] });
        expect(console.error).toHaveBeenCalledWith(
            '[AgentTool]',
            'get_price_stats',
            'daily closes failed, degrading',
            expect.not.objectContaining({ message: expect.anything() })
        );
    });

    it('when every subject failed there is no asOf, no correlation and core is not called', async () => {
        loaders.symbol.mockResolvedValue(null);
        const result = await run({ symbols: ['ZZZ', 'YYY'] });
        expect(result).toEqual({
            source: expect.any(String),
            subjects: [
                { subject: 'ZZZ', found: false },
                { subject: 'YYY', found: false },
            ],
        });
        expect(core.compute).not.toHaveBeenCalled();
    });

    it('a Korean listing whose last close is old is a stale_listing failure', async () => {
        asset.info.mockResolvedValue({
            symbol: '253450.KS',
            name: 'Old',
            marketProfile: 'kr-equity',
        });
        loaders.symbol.mockResolvedValue(
            loaded(weekdayCloses('2023-01-02', '2024-07-19'))
        );
        await expect(run({ symbols: ['253450.KS'] })).resolves.toEqual({
            source: expect.any(String),
            subjects: [
                {
                    subject: '253450.KS',
                    found: false,
                    error: 'stale_listing',
                    lastTradeDate: '2024-07-19',
                },
            ],
        });
    });

    it('a US series with an old last close is not stale-listed (only Korean listings are)', async () => {
        loaders.symbol.mockResolvedValue(
            loaded(weekdayCloses('2023-01-02', '2024-07-19'))
        );
        const result = await run({ symbols: ['OLD'] });
        expect(subjectsOf(result)[0]).toHaveProperty('returnPct');
    });

    it('a view core did not return falls back to found false instead of throwing', async () => {
        core.compute.mockReturnValueOnce({
            asOf: '2026-11-19',
            window: { kind: 'period', period: '1y' },
            subjects: [],
        });
        const result = await run({ symbols: ['AAPL'] });
        expect(subjectsOf(result)).toEqual([{ subject: 'AAPL', found: false }]);
    });
});

describe('getPriceStatsTool — same figure as get_bars_indicators calendarChange', () => {
    it.each([
        ['1m', '1month'],
        ['3m', '3months'],
        ['1y', '1year'],
    ] as const)(
        'period %s equals calendarChange[%s] on the same closes',
        async (period, key) => {
            const bars = US_CLOSES.map(c => ({
                time: Date.parse(`${c.date}T00:00:00Z`) / 1000,
                open: c.close,
                high: c.close,
                low: c.close,
                close: c.close,
                volume: 1,
            }));
            const expected = calendarChangeView(bars)[key];
            const result = await run({ symbols: ['AAPL'], period });
            const subject = subjectsOf(result)[0];
            expect(expected).not.toBeNull();
            expect(subject).toMatchObject({
                window: {
                    baseDate: expected?.baseDate,
                    baseClose: expected?.baseClose,
                },
                returnPct: expected?.pct,
            });
        }
    );
});

describe('getPriceStatsTool — worst case size', () => {
    it('three subjects with five dates each, every date status and three pairs stay under the cap and are never cut', async () => {
        asset.info.mockImplementation(async (symbol: string) => ({
            symbol,
            name: `${symbol} Corporation of a Fairly Long Registered Name`,
            fmpSymbol: `${symbol}-X`,
            ...(symbol === '005930.KS' ? { marketProfile: 'kr-equity' } : {}),
            ...(symbol === 'BTCUSD' ? { marketProfile: 'crypto' } : {}),
        }));
        // 1990-01-02 → 2026-11-19, KRW-sized closes with fractions, a gap year without sessions and an unusable row.
        const long = (offset: number) => [
            { date: '1990-01-01', close: -1 },
            ...weekdayCloses('1990-01-02', '2026-11-19')
                .filter(c => !c.date.startsWith('2008-03'))
                .map((c, i) => ({
                    date: c.date,
                    close:
                        1_234_567.891 +
                        offset +
                        Math.sin(i / 7) * 50_000 +
                        i * 13.37,
                })),
        ];
        loaders.symbol.mockImplementation(
            async (input: (typeof seen.inputs)[number]) =>
                loaded(long(input.symbol.length * 1_000), {
                    sessionInProgress: true,
                    source: 'full_history',
                })
        );
        const result = await run({
            symbols: ['005930.KS', 'BTCUSD', 'AAPL'],
            from: '1991-02-03',
            period: '10y',
            year: 2000,
            dates: [
                '2026-11-21',
                '2026-07-04',
                '2008-03-14',
                '1989-05-05',
                '2026-07-03',
            ],
        });
        const size = JSON.stringify(result).length;
        expect(size).toBeLessThan(PRICE_STATS_RESULT_MAX_CHARS);
        expect(
            truncateToolResult(result, PRICE_STATS_RESULT_MAX_CHARS)
        ).toEqual(result);
        expect(result).toMatchObject({ correlation: expect.any(Array) });
        expect(isRecord(result) && result.correlation).toHaveLength(3);
    });
});
