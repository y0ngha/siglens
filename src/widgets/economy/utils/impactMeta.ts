import type { CalendarImpact } from '@y0ngha/siglens-core';

/** 임팩트 렌더/필터 순서 — High → Medium → Low. */
export const IMPACT_ORDER: readonly CalendarImpact[] = [
    'High',
    'Medium',
    'Low',
];

/**
 * 임팩트 → `shared.enumLabel.riskLevel` 카탈로그 키 — 필터 칩·상세 뱃지 공통.
 * 값 자체(높음/보통/낮음)가 riskLevel 그룹과 동일해 새 그룹을 만들지 않고 재사용한다.
 */
export const IMPACT_LABEL_KEY: Record<CalendarImpact, string> = {
    High: 'riskLevel.high',
    Medium: 'riskLevel.medium',
    Low: 'riskLevel.low',
};
