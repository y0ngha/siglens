import type { BacktestCase } from '@y0ngha/siglens-core';

/**
 * `/backtesting` 화면 통계. `data.json`의 `meta`가 아니라 `cases`에서 직접
 * 계산한다 — `meta.aiWinRate`는 결정적(neutral 제외) 케이스만의 비율이고
 * `meta.period`는 손으로 쓴 문자열이라 실제 `entryDate` 범위와 어긋날 수 있다.
 * 2026-09-17 측정: `meta.aiWinRate`는 결정적 케이스 기준 8/13 = 61.5%이고
 * 100건 중 87건이 `neutral`이다(재확인: `data.json`의 `aiResult` 값을 센다).
 * 라벨에 필요한 분모(결정 건수 등)를 함께 내보내 UI가 "100 cases" 옆에
 * 분모 없이 61.5%만 보여주지 않게 한다.
 */
export interface BacktestStats {
    totalCases: number;
    indicatorWins: number;
    indicatorWinRate: number;
    aiDecisiveCount: number;
    aiWins: number;
    aiWinRateDecisive: number;
    aiNeutralCount: number;
    aiTrendHitRate: number;
    /** Mean of `returnPct` across all cases, 2 decimal places (small values need the extra digit — 1 decimal would round 0.36 to 0.4). */
    meanReturnPct: number;
    /** Median of `holdingDays`; can be fractional when the case count is even. */
    medianHoldingDays: number;
    /** ISO `YYYY-MM-DD`, min/max of `entryDate`. Empty string when `cases` is empty. */
    periodStart: string;
    periodEnd: string;
}

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

/** 케이스 목록에서 화면용 통계를 계산한다. 소비자: `BacktestHero`, `/backtesting` 페이지. */
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
