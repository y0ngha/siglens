import { createHash } from 'node:crypto';
import { canonicalJson } from '@y0ngha/siglens-core';
import backtestData from '@/entities/backtest-case/data/data.json';
import { validateBacktestRunData } from '@/entities/backtest-case/lib/validate';

const validTrade = {
    ticker: 'NVDA',
    entryType: 'wait_limit',
    decisionDate: '2025-03-11',
    entryDate: '2025-03-12',
    entryPrice: 100,
    exitDate: '2025-03-19',
    holdingDays: 5,
    returnPct: 3,
    legs: [
        {
            name: 'A',
            size: 0.5,
            exitDate: '2025-03-14',
            exitPrice: 102,
            reason: 'tp1',
            returnPct: 2,
        },
        {
            name: 'B',
            size: 0.5,
            exitDate: '2025-03-19',
            exitPrice: 104,
            reason: 'tp_final',
            returnPct: 4,
        },
    ],
    initialPlan: { tp1: 102, tpFinal: 104, sl1: 97, sl2: 95, source: 'ai' },
    holdingReviews: 4,
    summary: '눌림 구간에서 지지가 확인됐습니다.',
    promptFile: 'prompts/NVDA/2025-03-11_entry.json',
    responseFile: 'responses/NVDA/2025-03-11_entry.json',
};

const baseline = (ticker: string) => ({
    ticker,
    buyHoldPct: 10,
    buyHoldMaxDrawdownPct: -20,
    tradingDays: 501,
    exposureMatchedHoldPct: 6,
    markToMarketMaxDrawdownPct: -15,
});

/** `BacktestBenchmarks.tradesSha256`의 정의: `sha256(canonicalJson(trades))`. */
const tradesDigest = (trades: readonly unknown[]) =>
    createHash('sha256').update(canonicalJson(trades)).digest('hex');

const validBenchmarks = (trades: readonly unknown[]) => ({
    version: 1,
    tradesSha256: tradesDigest(trades),
    barsFingerprint: 'f'.repeat(64),
    coreSha: 'abc123',
    holdPortfolio: { returnPct: 44.29, maxDrawdownPct: -30 },
    exposureMatchedHold: {
        exposurePct: 62.5,
        returnPct: 27.5,
        maxDrawdownPct: -19.65,
    },
    strategyMarkToMarketMaxDrawdownPct: -12.39,
    perTradeExcess: {
        basis: 'same_length_drift',
        n: 1,
        meanPct: -0.06,
        baselineMeanPct: 3.06,
        ci95: { low: -0.4, high: 0.3 },
        clusters: 'week',
    },
    randomEntry: {
        draws: 2000,
        seed: 1,
        returnPct: { p5: 12.7, median: 29.5, p95: 49.9 },
        maxDrawdownPct: { p5: -24.4, median: -19.7, p95: -14.7 },
        shareAboveStrategyReturn: 0.509,
        shareWithSmallerDrawdown: 0.006,
    },
    bracket: {
        n: 1,
        initialPlan: { resolvedRaces: 1, targetFirstShare: 1 },
        placebo: { resolvedRaces: 3, targetFirstShare: 0.5 },
        storedTargetFirstShare: 1,
    },
});

function validData(overrides: Record<string, unknown> = {}) {
    const trades = (overrides['trades'] as unknown[] | undefined) ?? [
        validTrade,
    ];
    return {
        run: {
            runId: '2026-11-daily-ai',
            periodStart: '2024-11-01',
            periodEnd: '2026-11-02',
            tickers: ['NVDA', 'SPY'],
            model: 'deepseek-v4.1-flash',
            coreVersion: '2.29.0',
            promptVersion: 'p32',
            siglensVersion: '0.114.1',
            generatedAt: '2026-11-04T00:00:00.000Z',
            resultsUrl:
                'https://github.com/y0ngha/siglens/tree/master/backtest-results/2026-11-daily-ai',
            releaseUrl:
                'https://github.com/y0ngha/siglens/releases/tag/backtest-2026-11-daily-ai',
        },
        baselines: [baseline('NVDA'), baseline('SPY')],
        spy: baseline('SPY'),
        trendRecognition: {
            windowDays: 10,
            directionalCalls: 2,
            matchRatePct: 50,
            byTrend: {
                bullish: { calls: 1, priorMeanPct: 5, priorUpRatePct: 100 },
                bearish: { calls: 1, priorMeanPct: 3, priorUpRatePct: 100 },
                neutral: { calls: 0, priorMeanPct: 0, priorUpRatePct: 0 },
            },
        },
        trades,
        benchmarks: validBenchmarks(trades),
        ...overrides,
    };
}

/** `benchmarks`의 한 곳만 바꾼 데이터. */
const withBenchmarks = (patch: Record<string, unknown>) =>
    validData({ benchmarks: { ...validBenchmarks([validTrade]), ...patch } });

const withTrade = (patch: Record<string, unknown>) =>
    validData({ trades: [{ ...validTrade, ...patch }] });

const withLeg = (index: 0 | 1, patch: Record<string, unknown>) =>
    withTrade({
        legs: validTrade.legs.map((leg, i) =>
            i === index ? { ...leg, ...patch } : leg
        ),
    });

describe('validateBacktestRunData', () => {
    it('accepts the shipped data.json', () => {
        expect(() => validateBacktestRunData(backtestData)).not.toThrow();
    });

    it('returns the trades of a valid payload', () => {
        expect(validateBacktestRunData(validData()).trades).toHaveLength(1);
    });

    it('does not require the matched-hold fields on the unrendered spy baseline', () => {
        const {
            exposureMatchedHoldPct,
            markToMarketMaxDrawdownPct,
            ...oldSpy
        } = baseline('SPY');
        expect(exposureMatchedHoldPct).toBe(6);
        expect(markToMarketMaxDrawdownPct).toBe(-15);
        expect(() =>
            validateBacktestRunData(validData({ spy: oldSpy }))
        ).not.toThrow();
    });

    it('returns the benchmark block untouched', () => {
        const data = validData();
        expect(validateBacktestRunData(data).benchmarks).toBe(data.benchmarks);
    });

    // 거래 해시 짝은 런타임이 아니라 여기서 닫는다(브라우저 번들에 해시 구현을 넣지 않는다).
    it('pins the shipped tradesSha256 to the shipped trades', () => {
        expect(tradesDigest(backtestData.trades)).toBe(
            backtestData.benchmarks.tradesSha256
        );
    });

    it('detects a changed trade through the same digest', () => {
        const edited = backtestData.trades.map((trade, i) =>
            i === 0 ? { ...trade, summary: `${trade.summary} (수정)` } : trade
        );
        expect(tradesDigest(edited)).not.toBe(
            backtestData.benchmarks.tradesSha256
        );
    });

    it('ignores the key order of the shipped trades', () => {
        const reversed = backtestData.trades.map(trade =>
            Object.fromEntries(Object.entries(trade).toReversed())
        );
        expect(tradesDigest(reversed)).toBe(
            backtestData.benchmarks.tradesSha256
        );
    });

    it.each([
        ['a non-object payload', null, 'BacktestRunData must be an object'],
        [
            'a missing run',
            validData({ run: undefined }),
            'run must be an object',
        ],
        [
            'non-array trades',
            validData({ trades: {} }),
            'trades must be an array',
        ],
        [
            'a non-calendar date',
            withTrade({ entryDate: '2025-02-30' }),
            'trades[0].entryDate must be a YYYY-MM-DD string',
        ],
        [
            'an unknown entry type',
            withTrade({ entryType: 'market' }),
            'trades[0].entryType',
        ],
        [
            'an unknown leg reason',
            withLeg(1, { reason: 'trailing' }),
            'trades[0].legs[1].reason',
        ],
        [
            'a single leg',
            withTrade({ legs: [validTrade.legs[0]] }),
            'trades[0].legs must have exactly 2 entries',
        ],
        [
            'leg sizes that do not sum to 1',
            withLeg(0, { size: 0.4 }),
            'trades[0].legs sizes must sum to 1',
        ],
        [
            'a returnPct that is not the weighted leg mean',
            withTrade({ returnPct: 3.05 }),
            'trades[0].returnPct must equal the size-weighted leg return',
        ],
        [
            'an unknown plan source',
            withTrade({
                initialPlan: { ...validTrade.initialPlan, source: 'x' },
            }),
            'trades[0].initialPlan.source',
        ],
        [
            'two trades with the same ticker and entry date',
            validData({ trades: [validTrade, { ...validTrade }] }),
            'trades[1] duplicates trade key NVDA|2025-03-12',
        ],
        [
            'legs out of order',
            withTrade({ legs: [validTrade.legs[1], validTrade.legs[0]] }),
            'trades[0].legs must be ordered [A, B]',
        ],
        [
            'run tickers that differ from the baselines',
            validData({
                run: { ...validData().run, tickers: ['NVDA', 'SPY', 'QQQ'] },
            }),
            'run.tickers must equal the baseline tickers (mismatch: QQQ)',
        ],
        [
            'a missing trend recognition block',
            validData({ trendRecognition: undefined }),
            'trendRecognition must be an object',
        ],
        [
            'a trend label without stats',
            validData({
                trendRecognition: {
                    windowDays: 10,
                    directionalCalls: 0,
                    matchRatePct: 0,
                    byTrend: {},
                },
            }),
            'trendRecognition.byTrend.bullish must be an object',
        ],
        [
            'a trade ticker without a baseline',
            validData({
                run: { ...validData().run, tickers: ['SPY'] },
                baselines: [baseline('SPY')],
            }),
            'baselines must include every traded ticker (missing: NVDA)',
        ],
        [
            'a missing benchmarks block',
            validData({ benchmarks: undefined }),
            'benchmarks must be an object',
        ],
        [
            'a benchmarks block of another version',
            withBenchmarks({ version: 2 }),
            'benchmarks.version must be 1',
        ],
        [
            'a tradesSha256 that is not a hex digest',
            withBenchmarks({ tradesSha256: 'xyz' }),
            'benchmarks.tradesSha256 must be a 64-char hex digest',
        ],
        [
            'a missing hold portfolio',
            withBenchmarks({ holdPortfolio: undefined }),
            'benchmarks.holdPortfolio must be an object',
        ],
        [
            'a missing exposure matched hold return',
            withBenchmarks({
                exposureMatchedHold: { exposurePct: 62.5, maxDrawdownPct: -1 },
            }),
            'benchmarks.exposureMatchedHold.returnPct must be a finite number',
        ],
        [
            'a missing mark-to-market drawdown',
            withBenchmarks({ strategyMarkToMarketMaxDrawdownPct: undefined }),
            'benchmarks.strategyMarkToMarketMaxDrawdownPct must be a finite number',
        ],
        [
            'another per-trade excess basis',
            withBenchmarks({
                perTradeExcess: {
                    ...validBenchmarks([validTrade]).perTradeExcess,
                    basis: 'placebo',
                },
            }),
            'benchmarks.perTradeExcess.basis',
        ],
        [
            'a missing per-trade baseline mean',
            withBenchmarks({
                perTradeExcess: {
                    ...validBenchmarks([validTrade]).perTradeExcess,
                    baselineMeanPct: undefined,
                },
            }),
            'benchmarks.perTradeExcess.baselineMeanPct must be a finite number',
        ],
        [
            'a confidence range with low above high',
            withBenchmarks({
                perTradeExcess: {
                    ...validBenchmarks([validTrade]).perTradeExcess,
                    ci95: { low: 0.4, high: -0.4 },
                },
            }),
            'benchmarks.perTradeExcess.ci95 must satisfy low <= high',
        ],
        [
            'a distribution out of order',
            withBenchmarks({
                randomEntry: {
                    ...validBenchmarks([validTrade]).randomEntry,
                    returnPct: { p5: 50, median: 29.5, p95: 12 },
                },
            }),
            'benchmarks.randomEntry.returnPct must satisfy p5 <= median <= p95',
        ],
        [
            'a share written as a percent',
            withBenchmarks({
                randomEntry: {
                    ...validBenchmarks([validTrade]).randomEntry,
                    shareAboveStrategyReturn: 50.9,
                },
            }),
            'benchmarks.randomEntry.shareAboveStrategyReturn must be a share between 0 and 1',
        ],
        [
            'a missing bracket initial plan',
            withBenchmarks({
                bracket: {
                    ...validBenchmarks([validTrade]).bracket,
                    initialPlan: undefined,
                },
            }),
            'benchmarks.bracket.initialPlan must be an object',
        ],
        [
            'a fractional race count',
            withBenchmarks({
                bracket: {
                    ...validBenchmarks([validTrade]).bracket,
                    placebo: { resolvedRaces: 2.5, targetFirstShare: 0.5 },
                },
            }),
            'benchmarks.bracket.placebo.resolvedRaces must be a non-negative integer',
        ],
        [
            'a baseline without the exposure matched hold',
            validData({
                baselines: [
                    { ...baseline('NVDA'), exposureMatchedHoldPct: undefined },
                    baseline('SPY'),
                ],
            }),
            'baselines[0].exposureMatchedHoldPct must be a finite number',
        ],
        [
            'a baseline without the mark-to-market drawdown',
            validData({
                baselines: [
                    baseline('NVDA'),
                    {
                        ...baseline('SPY'),
                        markToMarketMaxDrawdownPct: undefined,
                    },
                ],
            }),
            'baselines[1].markToMarketMaxDrawdownPct must be a finite number',
        ],
    ])('rejects %s', (_label, input, message) => {
        expect(() => validateBacktestRunData(input)).toThrow(message);
    });
});
