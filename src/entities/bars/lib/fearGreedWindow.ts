import type {
    FearGreedHistoryPoint,
    FearGreedLabel,
} from '@y0ngha/siglens-core';

/** 점수가 매겨진(warm-up이 아닌) 공포·탐욕 시계열의 한 지점. */
export type ScoredPoint = {
    date: string;
    score: number;
    label: FearGreedLabel;
};

/**
 * `computeFearGreedHistory`가 돌려준 시계열에서 warm-up(`score === null`)을 걷어낸다.
 * 시계열 문장과 비교점 계산이 공유하는 전처리다.
 */
export function scoredHistory(
    history: readonly FearGreedHistoryPoint[]
): ScoredPoint[] {
    return history.flatMap(p =>
        p.score === null || p.label === null
            ? []
            : [{ date: p.date, score: p.score, label: p.label }]
    );
}

/** 최신 봉에서 `back`개 앞선 지점. 시계열이 짧으면 `null`. */
export function pointBefore(
    points: readonly ScoredPoint[],
    back: number
): ScoredPoint | null {
    return points[points.length - 1 - back] ?? null;
}

/** 대략적인 거래일 환산 — `FearGreedComparisonGauges`가 쓰는 값과 같다. */
export const TRADING_DAYS = { week: 5, month: 21, year: 252 } as const;

/** 3개월 환산 거래일. */
export const THREE_MONTHS_TRADING_DAYS = 63;

/** 점수 구간의 최저/최고 지점. 동률이면 **먼저 나온** 지점을 유지한다(엄격 비교). */
export function scoreExtremes(
    window: readonly ScoredPoint[]
): { min: ScoredPoint; max: ScoredPoint } | null {
    const first = window[0];
    if (first === undefined) return null;
    return window.reduce(
        (acc, p) => ({
            min: p.score < acc.min.score ? p : acc.min,
            max: p.score > acc.max.score ? p : acc.max,
        }),
        { min: first, max: first }
    );
}

/** 최근 1년(252거래일) 창의 최저/최고 — 페이지의 연간 범위 문장과 같은 창. */
export function yearScoreExtremes(
    points: readonly ScoredPoint[]
): { min: ScoredPoint; max: ScoredPoint } | null {
    return scoreExtremes(points.slice(-TRADING_DAYS.year));
}
