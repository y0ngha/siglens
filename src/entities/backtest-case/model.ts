/**
 * 백테스트 화면에 쓰는 통계.
 *
 * `data.json`의 `meta` 블록이 아니라 `cases`에서 직접 계산한다. `meta.aiWinRate`는 결정
 * 케이스(중립 제외)만 분모로 삼으므로, 화면이 분모 맥락(결정 케이스 수·중립 수)을 빠뜨리지
 * 않도록 라벨에 필요한 개수를 함께 담는다. `meta.period`도 손으로 적은 문자열이라 실제
 * `entryDate` 범위와 어긋날 수 있어 `periodStart`/`periodEnd`를 계산해 쓴다.
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
