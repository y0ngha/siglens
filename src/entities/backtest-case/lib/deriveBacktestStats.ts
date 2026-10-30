import type { BacktestCase } from '@y0ngha/siglens-core';
import type { BacktestStats } from '@/entities/backtest-case/model';

/** 소수 첫째 자리까지 반올림한 백분율. 분모가 0이면 0. */
function percent(count: number, total: number): number {
    return total > 0 ? Number(((count / total) * 100).toFixed(1)) : 0;
}

/** 빈 배열은 0, 짝수 개는 가운데 두 값의 평균. */
function median(values: readonly number[]): number {
    if (values.length === 0) return 0;
    const sorted = values.toSorted((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0
        ? sorted[mid]
        : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** 케이스 목록에서 화면용 통계를 계산한다. `meta` 블록은 읽지 않는다. 소비자: `BacktestHero`, `/backtesting` 페이지. */
export function deriveBacktestStats(
    cases: readonly BacktestCase[]
): BacktestStats {
    const total = cases.length;
    const indicatorWins = cases.filter(c => c.result === 'win').length;
    const decisive = cases.filter(c => c.aiResult !== 'neutral');
    const aiWins = decisive.filter(c => c.aiResult === 'win').length;
    const trendHits = cases.filter(c => c.aiTrendHit).length;
    const meanReturnPct =
        total > 0
            ? Number(
                  (
                      cases.reduce((sum, c) => sum + c.returnPct, 0) / total
                  ).toFixed(2)
              )
            : 0;
    // ISO `YYYY-MM-DD`는 사전순 정렬이 곧 날짜순이다.
    const entryDates = cases.map(c => c.entryDate).toSorted();

    return {
        totalCases: total,
        indicatorWins,
        indicatorWinRate: percent(indicatorWins, total),
        aiDecisiveCount: decisive.length,
        aiWins,
        aiWinRateDecisive: percent(aiWins, decisive.length),
        aiNeutralCount: total - decisive.length,
        aiTrendHitRate: percent(trendHits, total),
        meanReturnPct,
        medianHoldingDays: median(cases.map(c => c.holdingDays)),
        periodStart: entryDates[0] ?? '',
        periodEnd: entryDates[entryDates.length - 1] ?? '',
    };
}
