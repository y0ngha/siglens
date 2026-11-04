import type { BacktestRunData, BacktestTrade } from '@y0ngha/siglens-core';
import {
    EXIT_PATH_ORDER,
    exitPathOf,
} from '@/entities/backtest-case/lib/exitPath';
import type {
    BacktestStats,
    ExitPathStat,
    TickerStats,
} from '@/entities/backtest-case/model';

/** 4단계 판정(`summary.json`)과 같은 반올림 — 소수 둘째 자리. */
const round2 = (value: number): number => Number(value.toFixed(2));
const percentOf = (count: number, total: number): number =>
    total > 0 ? (count / total) * 100 : 0;

function mean(values: readonly number[]): number {
    return values.length > 0
        ? values.reduce((sum, v) => sum + v, 0) / values.length
        : 0;
}

function median(values: readonly number[]): number {
    if (values.length === 0) return 0;
    const sorted = values.toSorted((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0
        ? sorted[mid]
        : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** 시작 1.0에서 각 값까지의 고점 대비 최저(%). */
function maxDrawdownPct(curve: readonly number[]): number {
    const { worst } = curve.reduce(
        (acc, value) => {
            const peak = Math.max(acc.peak, value);
            return { peak, worst: Math.min(acc.worst, value / peak - 1) };
        },
        { peak: 1, worst: 0 }
    );
    return worst * 100;
}

const isClosed = (t: BacktestTrade): boolean =>
    t.legs.every(leg => leg.reason !== 'open');

/**
 * 종목 하나를 한 계좌로 굴린 청산 기준 곡선을 `dates` 축 위에 그린다. 한 종목의 매매는 서로
 * 겹치지 않으므로 청산일마다 복리로 곱한다. 보유 중 평가손익은 넣지 않는다.
 */
function equityOn(
    dates: readonly string[],
    trades: readonly BacktestTrade[]
): number[] {
    const factorByDate = new Map(
        Array.from(
            Map.groupBy(trades, t => t.exitDate),
            ([date, sameDay]) => [
                date,
                sameDay.reduce((f, t) => f * (1 + t.returnPct / 100), 1),
            ]
        )
    );
    // 불변 누적(CONVENTIONS.md#CP-6). 청산일은 수백 개라 전개 비용이 작아 가변 누적의 예외를 쓰지 않는다.
    return dates.reduce<number[]>(
        (curve, d) => [
            ...curve,
            (curve.at(-1) ?? 1) * (factorByDate.get(d) ?? 1),
        ],
        []
    );
}

function exitPathStats(trades: readonly BacktestTrade[]): ExitPathStat[] {
    const byPath = Map.groupBy(trades, exitPathOf);
    return EXIT_PATH_ORDER.flatMap(path => {
        const group = byPath.get(path) ?? [];
        return group.length > 0
            ? [
                  {
                      path,
                      trades: group.length,
                      meanReturnPct: round2(mean(group.map(t => t.returnPct))),
                  },
              ]
            : [];
    });
}

/**
 * 백테스트 화면 통계. 정의는 생성기의 4단계 판정과 같다 — 승률은 청산된 매매 중
 * `returnPct > 0` 비율, 포트폴리오는 종목 수만큼 같은 금액으로 나눈 계좌들의 날짜별 평균.
 * 날짜 축은 청산일의 합집합이다. 곡선이 청산일에만 바뀌므로 일봉 축과 같은 값이 나온다.
 */
export function deriveBacktestStats(data: BacktestRunData): BacktestStats {
    const closed = data.trades.filter(isClosed);
    const returns = closed.map(t => t.returnPct);
    const winningTrades = returns.filter(r => r > 0).length;
    // 곡선은 청산된 매매만으로 그린다 — 기간 말 보유 중인 매매의 평가손익은 실현되지 않았다.
    const dates = [...new Set(closed.map(t => t.exitDate))].toSorted();
    const byTicker = Map.groupBy(data.trades, t => t.ticker);
    const closedByTicker = Map.groupBy(closed, t => t.ticker);

    const curves = data.baselines.map(b =>
        equityOn(dates, closedByTicker.get(b.ticker) ?? [])
    );
    const perTicker: TickerStats[] = data.baselines.map((b, i) => {
        const trades = byTicker.get(b.ticker) ?? [];
        const tickerClosed = trades.filter(isClosed);
        const curve = curves[i];
        return {
            ticker: b.ticker,
            trades: trades.length,
            winRate: round2(
                percentOf(
                    tickerClosed.filter(t => t.returnPct > 0).length,
                    tickerClosed.length
                )
            ),
            strategyPct: round2(((curve.at(-1) ?? 1) - 1) * 100),
            strategyMaxDrawdownPct: round2(maxDrawdownPct(curve)),
            exposurePct: round2(
                percentOf(
                    trades.reduce((sum, t) => sum + t.holdingDays, 0),
                    b.tradingDays
                )
            ),
            buyHoldPct: b.buyHoldPct,
            buyHoldMaxDrawdownPct: b.buyHoldMaxDrawdownPct,
        };
    });
    const portfolio = dates.map((_, i) => mean(curves.map(c => c[i])));

    return {
        totalTrades: data.trades.length,
        closedTrades: closed.length,
        winningTrades,
        winRate: round2(percentOf(winningTrades, closed.length)),
        meanReturnPct: round2(mean(returns)),
        medianReturnPct: round2(median(returns)),
        meanHoldingDays: round2(mean(closed.map(t => t.holdingDays))),
        portfolioReturnPct: round2(((portfolio.at(-1) ?? 1) - 1) * 100),
        portfolioMaxDrawdownPct: round2(maxDrawdownPct(portfolio)),
        meanExposurePct: round2(mean(perTicker.map(p => p.exposurePct))),
        buyHoldMeanPct: round2(mean(data.baselines.map(b => b.buyHoldPct))),
        spy: {
            buyHoldPct: data.spy.buyHoldPct,
            buyHoldMaxDrawdownPct: data.spy.buyHoldMaxDrawdownPct,
        },
        perTicker,
        exitPaths: exitPathStats(data.trades),
        trendRecognition: data.trendRecognition,
        periodStart: data.run.periodStart,
        periodEnd: data.run.periodEnd,
    };
}
