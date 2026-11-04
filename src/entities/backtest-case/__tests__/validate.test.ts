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
});

function validData(overrides: Record<string, unknown> = {}) {
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
        trades: [validTrade],
        ...overrides,
    };
}

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
    ])('rejects %s', (_label, input, message) => {
        expect(() => validateBacktestRunData(input)).toThrow(message);
    });
});
