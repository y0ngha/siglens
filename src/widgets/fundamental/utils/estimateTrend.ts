import type { AnalystEstimatePeriod } from '@/entities/analyst-views/model';

export type EstimateChangeDirection = 'up' | 'down' | 'flat';

/** 이보다 작은 주당 변화는 "변화 없음"이다(부동소수 잡음). */
const CHANGE_EPSILON = 1e-4;

/** 화면에 싣는 순서: 이번 분기 → 다음 분기 → 이번 회계연도 → 다음 회계연도. */
const PERIOD_ORDER: readonly string[] = ['0q', '+1q', '0y', '+1y'];

/** EPS 추정치가 있는 기간만, 정해진 순서로. 매출만 있는 기간은 이 섹션의 대상이 아니다. */
export function visibleEstimatePeriods(
    periods: readonly AnalystEstimatePeriod[]
): AnalystEstimatePeriod[] {
    return PERIOD_ORDER.flatMap(code =>
        periods.filter(row => row.period === code && row.eps.avg !== null)
    );
}

/**
 * 추정치 변화의 방향. 주당 금액이라 아주 작은 차이(부동소수 잡음, 반올림 단위 이하)는 변화 없음으로 본다. 적자 EPS도
 * 같다 — `-2.2`가 `-4.1`보다 크므로 "올랐다"(적자 폭 축소)다.
 */
export function estimateChangeDirection(
    change: number
): EstimateChangeDirection {
    if (Math.abs(change) < CHANGE_EPSILON) return 'flat';
    return change > 0 ? 'up' : 'down';
}

export interface RevisionShare {
    up: number;
    down: number;
    /** 막대 너비(퍼센트, 합 100). */
    upPct: number;
    downPct: number;
}

/** 최근 30일 상향·하향 애널리스트 수. 둘 다 0이거나 값이 없으면 `null`(막대·문구를 그리지 않는다). */
export function revisionShare(
    row: AnalystEstimatePeriod
): RevisionShare | null {
    const up = row.revisions.up30d ?? 0;
    const down = row.revisions.down30d ?? 0;
    const total = up + down;
    if (total === 0) return null;
    const upPct = Math.round((up / total) * 100);
    return { up, down, upPct, downPct: 100 - upPct };
}
