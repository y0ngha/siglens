import type { FearGreedLabel, FearGreedReading } from '@y0ngha/siglens-core';
import { FEAR_GREED_SESSIONS_PER_YEAR } from '@/entities/market-fear-greed/lib/buildMarketFearGreedComparisons';
import type { ScoredReading } from '@/entities/market-fear-greed/lib/publishableHistory';

/**
 * 허브의 "지난 점수 기록" 표가 쓰는 표시용 집계. 이미 계산된 점수 열을 날짜·월로 묶고
 * 자를 뿐이라 분석 규칙이 아니다(SCOPE.md §6 "표시 포맷"). 문구는 만들지 않는다.
 */

/** 최근 표의 행 수. 하한(`FEAR_GREED_HISTORY_MIN_POINTS`)과 같아 표가 늘 꽉 찬다. */
export const RECENT_HISTORY_ROWS = 20;

/** 월별 표에서 바로 펼쳐 보이는 최근 개월 수. 더 오래된 달은 접어 둔다. */
export const MONTHLY_ROWS_OPEN = 12;

/** 차트에 싣는 점 수. 차트가 그리는 길이(`toLineData`)와 같은 상수다. */
export const HISTORY_CHART_POINTS = FEAR_GREED_SESSIONS_PER_YEAR;

export interface HistoryCoverage {
    /** 첫 점수 날짜. */
    from: string;
    /** 마지막 점수 날짜. */
    to: string;
    /** 점수 있는 날 수. */
    count: number;
}

export interface RecentHistoryRow {
    date: string;
    score: number;
    label: FearGreedLabel;
    /** 직전 점수 있는 날 대비 변화. 기록의 첫 점만 `null`. */
    change: number | null;
}

export interface MonthlyHistoryRow {
    /** `YYYY-MM`. */
    month: string;
    last: { date: string; score: number; label: FearGreedLabel };
    /** 그 달 최저. 같은 값이면 먼저 나온 날. */
    low: { date: string; score: number };
    /** 그 달 최고. 같은 값이면 먼저 나온 날. */
    high: { date: string; score: number };
    /** 기록 첫 달이면 `'start'`, 마지막 점이 든 달이면 `'end'`. 둘 다면 `'end'`. */
    partial: 'start' | 'end' | null;
}

/** 점수 있는 점의 기간과 개수. 호출부가 하한(`publishableHistory`)을 통과시킨 뒤 부른다. */
export function historyCoverage(
    points: readonly ScoredReading[]
): HistoryCoverage {
    return {
        from: points.at(0)?.date ?? '',
        to: points.at(-1)?.date ?? '',
        count: points.length,
    };
}

/** 최근 `RECENT_HISTORY_ROWS`일, 최신이 먼저. */
export function recentHistoryRows(
    points: readonly ScoredReading[]
): RecentHistoryRow[] {
    const firstIndex = Math.max(0, points.length - RECENT_HISTORY_ROWS);
    return points
        .map((point, index): RecentHistoryRow => ({
            date: point.date,
            score: point.score,
            label: point.label,
            change: index === 0 ? null : point.score - points[index - 1].score,
        }))
        .slice(firstIndex)
        .reverse();
}

/** 달별 마지막·최저·최고, 최신 달이 먼저. */
export function monthlyHistoryRows(
    points: readonly ScoredReading[]
): MonthlyHistoryRow[] {
    const byMonth = Object.groupBy(points, point => point.date.slice(0, 7));
    const firstMonth = points.at(0)?.date.slice(0, 7);
    const lastMonth = points.at(-1)?.date.slice(0, 7);
    return Object.entries(byMonth)
        .flatMap(([month, monthPoints]): MonthlyHistoryRow[] => {
            const last = monthPoints?.at(-1);
            if (monthPoints === undefined || last === undefined) return [];
            // 점수가 같으면 먼저 나온 날을 남긴다(strict 비교).
            const low = monthPoints.reduce((a, b) =>
                b.score < a.score ? b : a
            );
            const high = monthPoints.reduce((a, b) =>
                b.score > a.score ? b : a
            );
            const partialOf = (): MonthlyHistoryRow['partial'] => {
                if (month === lastMonth) return 'end';
                return month === firstMonth ? 'start' : null;
            };
            return [
                {
                    month,
                    last: {
                        date: last.date,
                        score: last.score,
                        label: last.label,
                    },
                    low: { date: low.date, score: low.score },
                    high: { date: high.date, score: high.score },
                    partial: partialOf(),
                },
            ];
        })
        .sort((a, b) => b.month.localeCompare(a.month));
}

/** 차트에 넘기는 조각: 마지막 `HISTORY_CHART_POINTS`개, 날짜 오름차순. 전체 기록은 클라이언트로 보내지 않는다. */
export function chartHistory(
    points: readonly ScoredReading[]
): FearGreedReading[] {
    return points.slice(-HISTORY_CHART_POINTS);
}
