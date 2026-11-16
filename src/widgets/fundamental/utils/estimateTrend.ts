import type { AnalystEstimatePeriod } from '@/entities/analyst-views/model';

export type EstimateChangeDirection = 'up' | 'down' | 'flat';

/** 화면에 싣는 기간 코드와 순서: 이번 분기 → 다음 분기 → 이번 회계연도 → 다음 회계연도. 라벨 맵도 이 유니온에서 나온다. */
export const ESTIMATE_PERIOD_CODES = ['0q', '+1q', '0y', '+1y'] as const;
export type EstimatePeriodCode = (typeof ESTIMATE_PERIOD_CODES)[number];

/** 화면에 싣는 기간 — 코드가 위 네 가지 중 하나이고 EPS 추정치가 있다. */
export interface VisibleEstimatePeriod extends AnalystEstimatePeriod {
    period: EstimatePeriodCode;
}

const PERCENT = 100;

function isVisible(
    row: AnalystEstimatePeriod,
    code: EstimatePeriodCode
): row is VisibleEstimatePeriod {
    return row.period === code && row.eps.avg !== null;
}

/**
 * EPS 추정치가 있는 기간만, 정해진 순서로. 매출만 있는 기간과 모르는 기간 코드(Yahoo가 새 기간을 더해도)는 이
 * 섹션의 대상이 아니다 — 모르는 코드를 다른 라벨로 보여 주지 않는다.
 */
export function visibleEstimatePeriods(
    periods: readonly AnalystEstimatePeriod[]
): VisibleEstimatePeriod[] {
    return ESTIMATE_PERIOD_CODES.flatMap(code =>
        periods.filter((row): row is VisibleEstimatePeriod =>
            isVisible(row, code)
        )
    );
}

/**
 * 추정치 변화의 방향. 기준은 하나다: 화면 표시 단위(달러 센트, 원)로 반올림해 0이면(`displaysAsZero`) 변화 없음 —
 * `▼ US$0.00`처럼 방향과 값이 어긋나 보이지 않게. 적자 EPS도 같다 — `-2.2`가 `-4.1`보다 크므로 "올랐다"(적자 폭
 * 축소)다.
 */
export function estimateChangeDirection(
    change: number,
    displaysAsZero: boolean
): EstimateChangeDirection {
    if (displaysAsZero || change === 0) return 'flat';
    return change > 0 ? 'up' : 'down';
}

interface RevisionShare {
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
    const upPct = Math.round((up / total) * PERCENT);
    return { up, down, upPct, downPct: PERCENT - upPct };
}
