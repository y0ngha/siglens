import type { BacktestBenchmarks } from '@y0ngha/siglens-core';
import type {
    BacktestStats,
    TickerStats,
} from '@/entities/backtest-case/model';

/**
 * 위젯 테스트용 통계 픽스처. 필드마다 서로 다른 값을 둔다(값이 겹치면 두 필드를 바꿔 읽어도
 * 통과한다) — 수익률·낙폭은 생성기 출력처럼 반올림되지 않은 값이다.
 */
export const BENCHMARKS: BacktestBenchmarks = {
    version: 1,
    tradesSha256: 'a'.repeat(64),
    barsFingerprint: 'b'.repeat(64),
    coreSha: 'c0ffee',
    holdPortfolio: { returnPct: 44.2921, maxDrawdownPct: -29.9994 },
    exposureMatchedHold: {
        exposurePct: 62.495,
        returnPct: 27.499,
        maxDrawdownPct: -19.6524,
    },
    strategyMarkToMarketMaxDrawdownPct: -12.3901,
    perTradeExcess: {
        basis: 'same_length_drift',
        n: 690,
        meanPct: -0.0602,
        ci95: { low: -0.4009, high: 0.3021 },
        clusters: 'week',
    },
    randomEntry: {
        draws: 2000,
        seed: 650227714,
        returnPct: { p5: 12.6988, median: 29.4794, p95: 49.9152 },
        maxDrawdownPct: { p5: -24.3956, median: -19.6684, p95: -14.7418 },
        shareAboveStrategyReturn: 0.509,
        shareWithSmallerDrawdown: 0.006,
    },
    bracket: {
        n: 641,
        initialPlan: { resolvedRaces: 641, targetFirstShare: 0.5273 },
        placebo: { resolvedRaces: 1919, targetFirstShare: 0.4914 },
        storedTargetFirstShare: 0.5663,
    },
};

export const tickerStats = (
    ticker: string,
    patch: Partial<TickerStats> = {}
): TickerStats => ({
    ticker,
    trades: 65,
    winRate: 60.3077,
    strategyPct: 47.0812,
    strategyMaxDrawdownPct: -14.4412,
    exposurePct: 66.8663,
    buyHoldPct: 23.6112,
    buyHoldMaxDrawdownPct: -34.9183,
    exposureMatchedHoldPct: 15.8271,
    markToMarketMaxDrawdownPct: -17.2144,
    ...patch,
});

export const makeStats = (
    patch: Partial<BacktestStats> = {}
): BacktestStats => ({
    totalTrades: 690,
    closedTrades: 688,
    winningTrades: 395,
    winRate: 57.4128,
    meanReturnPct: 0.3912,
    medianReturnPct: 0.4311,
    meanHoldingDays: 4.5412,
    portfolioReturnPct: 29.0912,
    portfolioMaxDrawdownPct: -9.2911,
    perTicker: [tickerStats('MSFT'), tickerStats('SPY')],
    benchmarks: BENCHMARKS,
    exitPaths: [],
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
    periodStart: '2024-11-01',
    periodEnd: '2026-11-02',
    ...patch,
});
