import type { FearGreedHistoryPoint } from '@y0ngha/siglens-core';
import { MS_PER_DAY } from '@/shared/config/time';
import { toLineData } from './toLineData';

/** 평균 한 달(365.25 / 12일). 달력 간격을 개월 수로 바꿀 때 쓴다. */
const DAYS_PER_MONTH = 30.4375;

/** 1년으로 읽는 최소 개월 수. */
const MONTHS_PER_YEAR = 12;

/** 차트가 실제로 그리는 기간. 1년 이상이면 `year`, 짧으면 개월 수. */
export type ChartWindow =
    | { readonly kind: 'year' }
    | { readonly kind: 'months'; readonly months: number };

/**
 * 차트가 그리는 점(`toLineData`의 마지막 252점)이 실제로 걸친 기간.
 *
 * 252는 **세션** 수라 주식은 약 1년이지만 24시간 거래하는 암호화폐는 약 8개월이다.
 * 제목·접근성 이름이 "최근 1년"으로 고정돼 있으면 암호화폐에서 틀리므로, 그려지는 첫 점과
 * 마지막 점의 달력 간격에서 정한다. 이력이 짧아도 같은 방식으로 짧은 기간이 나온다.
 * 그릴 점이 없으면 기존 이름(`year`)을 그대로 둔다 — 없는 기간을 지어내지 않고, 빈 차트의
 * 이름은 어차피 아무것도 가리키지 않는다.
 */
export function chartWindow(
    history: readonly FearGreedHistoryPoint[]
): ChartWindow {
    const points = toLineData(history);
    const first = points.at(0);
    const last = points.at(-1);
    if (first === undefined || last === undefined) {
        return { kind: 'year' };
    }
    const days =
        (Date.parse(`${last.time}T00:00:00Z`) -
            Date.parse(`${first.time}T00:00:00Z`)) /
        MS_PER_DAY;
    const months = Math.max(1, Math.round(days / DAYS_PER_MONTH));
    return months >= MONTHS_PER_YEAR
        ? { kind: 'year' }
        : { kind: 'months', months };
}
