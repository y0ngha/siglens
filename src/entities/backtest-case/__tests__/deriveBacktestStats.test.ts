import type {
    BacktestBenchmarks,
    BacktestLegExitReason,
    BacktestTrade,
} from '@y0ngha/siglens-core';
import type { VerifiedBacktestRunData } from '@/entities/backtest-case/model';
import summary from '../../../../backtest-results/2026-11-daily-ai/summary.json';
import backtestData from '@/entities/backtest-case/data/data.json';
import { deriveBacktestStats } from '@/entities/backtest-case/lib/deriveBacktestStats';
import { validateBacktestRunData } from '@/entities/backtest-case/lib/validate';

function trade(
    ticker: string,
    exitDate: string,
    returnPct: number,
    holdingDays: number,
    reasons: readonly [BacktestLegExitReason, BacktestLegExitReason] = [
        'tp1',
        'tp_final',
    ]
): BacktestTrade {
    return {
        ticker,
        entryType: 'wait_limit',
        decisionDate: '2025-01-01',
        entryDate: '2025-01-02',
        entryPrice: 100,
        exitDate,
        holdingDays,
        returnPct,
        legs: [
            {
                name: 'A',
                size: 0.5,
                exitDate,
                exitPrice: 100,
                reason: reasons[0],
                returnPct,
            },
            {
                name: 'B',
                size: 0.5,
                exitDate,
                exitPrice: 100,
                reason: reasons[1],
                returnPct,
            },
        ],
        initialPlan: { tp1: 101, tpFinal: 102, sl1: 99, sl2: 98, source: 'ai' },
        holdingReviews: 0,
        summary: '',
    };
}

// 필드마다 다른 값을 둔다 — 두 필드를 바꿔 읽는 회귀가 같은 값 때문에 가려지지 않게.
const baseline = (
    ticker: string,
    buyHoldPct: number,
    exposureMatchedHoldPct: number,
    markToMarketMaxDrawdownPct: number
) => ({
    ticker,
    buyHoldPct,
    buyHoldMaxDrawdownPct: -10,
    tradingDays: 10,
    exposureMatchedHoldPct,
    markToMarketMaxDrawdownPct,
});

const BENCHMARKS: BacktestBenchmarks = {
    version: 1,
    tradesSha256: 'd'.repeat(64),
    barsFingerprint: 'e'.repeat(64),
    coreSha: 'abc123',
    holdPortfolio: { returnPct: 1.5, maxDrawdownPct: -7.5 },
    exposureMatchedHold: {
        exposurePct: 41.5,
        returnPct: 0.6,
        maxDrawdownPct: -4.25,
    },
    strategyMarkToMarketMaxDrawdownPct: -12.75,
    perTradeExcess: {
        basis: 'same_length_drift',
        n: 3,
        meanPct: 0.125,
        baselineMeanPct: 0.875,
        ci95: { low: -1.5, high: 1.75 },
        clusters: 'week',
    },
    randomEntry: {
        draws: 100,
        seed: 7,
        returnPct: { p5: -5.5, median: 1.25, p95: 6.5 },
        maxDrawdownPct: { p5: -20.5, median: -9.5, p95: -3.5 },
        shareAboveStrategyReturn: 0.37,
        shareWithSmallerDrawdown: 0.21,
    },
    bracket: {
        n: 2,
        initialPlan: { resolvedRaces: 2, targetFirstShare: 0.5 },
        placebo: { resolvedRaces: 6, targetFirstShare: 0.33 },
        storedTargetFirstShare: 0.75,
    },
};

function run(trades: BacktestTrade[]): VerifiedBacktestRunData {
    return {
        run: {
            runId: 't',
            periodStart: '2025-01-01',
            periodEnd: '2025-01-31',
            tickers: ['AAA', 'BBB'],
            model: 'm',
            coreVersion: '0',
            promptVersion: 'p',
            siglensVersion: '0',
            generatedAt: '',
            resultsUrl: '',
            releaseUrl: '',
        },
        baselines: [
            baseline('AAA', 5, 2.5, -6.25),
            baseline('BBB', -5, -2.75, -8.5),
        ],
        spy: baseline('SPY', 3, 1.5, -3.25),
        trendRecognition: {
            windowDays: 10,
            directionalCalls: 0,
            matchRatePct: 0,
            byTrend: {
                bullish: { calls: 0, priorMeanPct: 0, priorUpRatePct: 0 },
                bearish: { calls: 0, priorMeanPct: 0, priorUpRatePct: 0 },
                neutral: { calls: 0, priorMeanPct: 0, priorUpRatePct: 0 },
            },
        },
        trades,
        benchmarks: BENCHMARKS,
    };
}

describe('deriveBacktestStats', () => {
    // AAA: +10% (1/10) → −20% (1/20) ⇒ 1.1 × 0.8 = 0.88. BBB: +5% (1/15).
    const stats = deriveBacktestStats(
        run([
            trade('AAA', '2025-01-10', 10, 2),
            trade('BBB', '2025-01-15', 5, 4, ['sl1', 'sl2']),
            trade('AAA', '2025-01-20', -20, 3, ['sl1', 'sl2']),
        ])
    );

    it('counts wins over closed trades', () => {
        expect(stats.totalTrades).toBe(3);
        expect(stats.closedTrades).toBe(3);
        expect(stats.winningTrades).toBe(2);
        expect(stats.winRate).toBe(66.67);
        expect(stats.meanReturnPct).toBe(-1.67);
        expect(stats.medianReturnPct).toBe(5);
        expect(stats.meanHoldingDays).toBe(3);
    });

    it('compounds each ticker on its exit dates', () => {
        const aaa = stats.perTicker.find(p => p.ticker === 'AAA');
        expect(aaa?.strategyPct).toBe(-12);
        expect(aaa?.strategyMaxDrawdownPct).toBe(-20);
        expect(aaa?.exposurePct).toBe(50);
    });

    it('averages equal-weight sleeves for the portfolio', () => {
        // 날짜별 평균: 1/10 (1.1+1)/2=1.05, 1/15 (1.1+1.05)/2=1.075, 1/20 (0.88+1.05)/2=0.965
        expect(stats.portfolioReturnPct).toBe(-3.5);
        expect(stats.portfolioMaxDrawdownPct).toBe(-10.23);
    });

    it('passes the generator baselines through per ticker without recomputing them', () => {
        expect(stats.perTicker.map(p => p.ticker)).toEqual(['AAA', 'BBB']);
        expect(stats.perTicker[0]).toMatchObject({
            buyHoldPct: 5,
            buyHoldMaxDrawdownPct: -10,
            exposureMatchedHoldPct: 2.5,
            markToMarketMaxDrawdownPct: -6.25,
        });
        expect(stats.perTicker[1]).toMatchObject({
            buyHoldPct: -5,
            exposureMatchedHoldPct: -2.75,
            markToMarketMaxDrawdownPct: -8.5,
        });
    });

    it('passes the benchmark block through by reference', () => {
        expect(stats.benchmarks).toBe(BENCHMARKS);
    });

    it('leaves still-open trades out of the equity curves and the win rate', () => {
        const withOpen = deriveBacktestStats(
            run([
                trade('AAA', '2025-01-10', 10, 2),
                trade('AAA', '2025-01-31', 50, 5, ['open', 'open']),
            ])
        );
        expect(withOpen.totalTrades).toBe(2);
        expect(withOpen.closedTrades).toBe(1);
        expect(
            withOpen.perTicker.find(p => p.ticker === 'AAA')?.strategyPct
        ).toBe(10);
    });

    it('groups exit paths in display order', () => {
        expect(stats.exitPaths).toEqual([
            { path: 'tp1_tpFinal', trades: 1, meanReturnPct: 10 },
            { path: 'sl1_sl2', trades: 2, meanReturnPct: -7.5 },
        ]);
    });

    it('reproduces the published summary.json from the shipped data.json', () => {
        const shipped = deriveBacktestStats(
            validateBacktestRunData(backtestData)
        );
        expect(shipped.totalTrades).toBe(summary.overall.trades);
        expect(shipped.winRate).toBe(summary.overall.winRate);
        expect(shipped.meanReturnPct).toBe(summary.overall.meanRet);
        expect(shipped.medianReturnPct).toBe(summary.overall.medianRet);
        expect(shipped.meanHoldingDays).toBe(summary.overall.meanHoldDays);
        expect(shipped.portfolioReturnPct).toBe(summary.portfolio.returnPct);
        expect(shipped.portfolioMaxDrawdownPct).toBe(
            summary.portfolio.maxDrawdownPct
        );
        expect(shipped.trendRecognition).toEqual(summary.trendRecognition);
        expect(shipped.benchmarks).toEqual(summary.benchmarks);
        expect(shipped.benchmarks.holdPortfolio.returnPct).toBeCloseTo(
            summary.benchmark.meanTickerBuyHoldPct,
            2
        );
        for (const expected of summary.perTicker) {
            const actual = shipped.perTicker.find(
                p => p.ticker === expected.ticker
            );
            expect(actual).toMatchObject({
                trades: expected.trades,
                winRate: expected.winRate,
                strategyPct: expected.strategyPct,
                strategyMaxDrawdownPct: expected.strategyMaxDrawdownPct,
                exposurePct: expected.exposurePct,
                buyHoldPct: expected.buyHoldPct,
                buyHoldMaxDrawdownPct: expected.buyHoldMaxDrawdownPct,
            });
        }
    });
});
