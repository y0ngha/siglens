import type {
    BacktestLegExitReason,
    BacktestRunData,
    BacktestTrade,
} from '@y0ngha/siglens-core';
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

const baseline = (ticker: string, buyHoldPct: number) => ({
    ticker,
    buyHoldPct,
    buyHoldMaxDrawdownPct: -10,
    tradingDays: 10,
});

function run(trades: BacktestTrade[]): BacktestRunData {
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
        baselines: [baseline('AAA', 5), baseline('BBB', -5)],
        spy: baseline('SPY', 3),
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
        expect(aaa?.buyHoldPct).toBe(5);
    });

    it('averages equal-weight sleeves for the portfolio', () => {
        // 날짜별 평균: 1/10 (1.1+1)/2=1.05, 1/15 (1.1+1.05)/2=1.075, 1/20 (0.88+1.05)/2=0.965
        expect(stats.portfolioReturnPct).toBe(-3.5);
        expect(stats.portfolioMaxDrawdownPct).toBe(-10.23);
        expect(stats.spy.buyHoldPct).toBe(3);
    });

    it('averages ticker buy-and-hold for the same-universe benchmark', () => {
        expect(stats.buyHoldMeanPct).toBe(0);
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
        expect(shipped.meanExposurePct).toBe(summary.portfolio.meanExposurePct);
        expect(shipped.trendRecognition).toEqual(summary.trendRecognition);
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
            });
        }
    });
});
