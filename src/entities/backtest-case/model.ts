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
    /** 전체 케이스 `returnPct`의 평균. 소수 2자리(작은 값은 한 자리 더 필요하다 — 1자리면 0.36이 0.4로 반올림된다). */
    meanReturnPct: number;
    /** `holdingDays`의 중앙값. 케이스 수가 짝수면 소수일 수 있다. */
    medianHoldingDays: number;
    /** `entryDate`의 최솟값/최댓값(ISO `YYYY-MM-DD`). `cases`가 비면 빈 문자열이다. */
    periodStart: string;
    periodEnd: string;
}
