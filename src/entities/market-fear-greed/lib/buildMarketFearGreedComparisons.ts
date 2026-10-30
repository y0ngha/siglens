import type { FearGreedLabel } from '@y0ngha/siglens-core';
import { MS_PER_DAY } from '@/shared/config/time';
import type {
    FearGreedLookbackPoint,
    MarketFearGreedComparisonKey,
    MarketFearGreedComparisonPoint,
} from '../model';

/**
 * walk-forward 이력의 한 점. 구조적으로 타입을 줘서 시장(`MarketFearGreedHistoryPoint`)과
 * 크립토(`FearGreedHistoryPoint`) 이력이 캐스트 없이 모두 들어맞는다 — 둘은
 * `{ date, score, label }` 모양을 공유한다.
 */
interface HistoryPoint {
    date: string;
    score: number | null;
    label: FearGreedLabel | null;
}

type ScoredPoint = HistoryPoint & { score: number; label: FearGreedLabel };

/** 워밍업 구간 점은 `null`을 싣는다. 점수·라벨이 다 있는 점만 비교할 수 있다. */
function scoredPoints(history: readonly HistoryPoint[]): ScoredPoint[] {
    return history.filter(
        (point): point is ScoredPoint =>
            point.score !== null && point.label !== null
    );
}

function toComparison(
    key: MarketFearGreedComparisonKey,
    point: ScoredPoint
): MarketFearGreedComparisonPoint {
    return { key, date: point.date, score: point.score, label: point.label };
}

/**
 * 1년의 거래 세션 수. "1년 전" 과거 시점이며, 종목별 페이지도 "지난 1년" 차트를 같은 개수로
 * 자른다 — 둘이 어긋나면 차트의 첫 점과 "1년 전" 게이지가 서로 다른 날을 가리킨다.
 */
export const FEAR_GREED_SESSIONS_PER_YEAR = 252;

/**
 * 거래 세션 단위 과거 시점. 종목 페이지 게이지와 맞춰 두 공포·탐욕 화면이 같은 방식으로
 * 읽히게 한다: 주 ~5 세션, 월 ~21, 연 ~252.
 */
const COMPARISON_OFFSETS = [
    { key: 'now', sessionsBack: 0 },
    { key: '1w', sessionsBack: 5 },
    { key: '1m', sessionsBack: 21 },
    { key: '1y', sessionsBack: FEAR_GREED_SESSIONS_PER_YEAR },
] as const satisfies ReadonlyArray<{
    key: MarketFearGreedComparisonKey;
    sessionsBack: number;
}>;

/**
 * walk-forward 이력을 네 개의 세션 과거 시점으로 줄이고, 이력이 너무 짧아 닿지 못한 것은
 * 표시한다.
 *
 * "현재"를 과거 세션과 비교하는 모든 공포·탐욕 화면(시장 페이지와 종목별 게이지)이 공유해
 * 과거 시점을 같은 방식으로 센다.
 *
 * 워밍업 점은 `null` 점수를 싣기 때문에 오프셋은 *점수가 있는* 세션만 세어 계산한다 —
 * 아니면 "1년 전"이 워밍업 구간에 떨어져 조용히 사라질 수 있다. 이력이 과거 시점보다
 * 짧으면 인덱스를 점수가 있는 가장 이른 세션으로 당기고 `clamped`를 켠다. 반환된 `date`가
 * 실제로 쓴 세션을 알려준다.
 *
 * @param history - 날짜 오름차순 walk-forward 이력.
 * @returns 네 점. 점수가 있는 점이 아직 없으면 빈 배열.
 */
export function resolveSessionComparisons(
    history: readonly HistoryPoint[]
): FearGreedLookbackPoint[] {
    const scored = scoredPoints(history);
    if (scored.length === 0) return [];

    const latest = scored.length - 1;

    return COMPARISON_OFFSETS.map(({ key, sessionsBack }) => ({
        ...toComparison(key, scored[Math.max(0, latest - sessionsBack)]),
        clamped: sessionsBack > latest,
    }));
}

/**
 * Reduce a walk-forward history to the four readings the market page shows.
 * Same lookbacks as {@link resolveSessionComparisons}, without the `clamped` flag.
 *
 * @param history - Walk-forward history, ascending by date.
 * @returns Four points, or an empty array when nothing is scored yet.
 */
export function buildMarketFearGreedComparisons(
    history: readonly HistoryPoint[]
): MarketFearGreedComparisonPoint[] {
    return resolveSessionComparisons(history).map(
        ({ key, date, score, label }) => ({ key, date, score, label })
    );
}

/** 매일 거래되는 시장(크립토)용 달력일 단위 과거 시점. */
const CALENDAR_COMPARISON_OFFSETS = [
    { key: 'now', daysBack: 0 },
    { key: '1w', daysBack: 7 },
    { key: '1m', daysBack: 30 },
    { key: '1y', daysBack: 365 },
] as const satisfies ReadonlyArray<{
    key: MarketFearGreedComparisonKey;
    daysBack: number;
}>;

/**
 * {@link buildMarketFearGreedComparisons}의 달력일 버전.
 *
 * 크립토는 주 7일 거래라 "1주 전"은 다섯 세션이 아니라 달력일로 7일 전 같은 요일이다.
 * 오프셋은 인덱스가 아니라 날짜로 푼다: inner join에서 떨어진 날(코인 하나가 봉이
 * 없을 때)이 있으면 인덱스 방식은 모든 과거 시점을 하루씩 밀어 버린다. 각 시점은 목표
 * 날짜 이하의 마지막 점수 점을 취하고, 없으면 점수가 있는 가장 이른 점으로 당긴다.
 *
 * @param history - 날짜 오름차순 walk-forward 이력.
 * @returns 네 점. 점수가 있는 점이 아직 없으면 빈 배열.
 */
export function buildCalendarDayComparisons(
    history: readonly HistoryPoint[]
): MarketFearGreedComparisonPoint[] {
    const scored = scoredPoints(history);
    if (scored.length === 0) return [];

    const latestMs = Date.parse(scored[scored.length - 1].date);

    return CALENDAR_COMPARISON_OFFSETS.map(({ key, daysBack }) => {
        const target = new Date(latestMs - daysBack * MS_PER_DAY)
            .toISOString()
            .slice(0, 10);
        const point = scored.findLast(p => p.date <= target) ?? scored[0];
        return toComparison(key, point);
    });
}
