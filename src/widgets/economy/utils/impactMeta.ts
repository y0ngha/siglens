import type { CalendarImpact } from '@y0ngha/siglens-core';

/** 임팩트 렌더/필터 순서 — High → Medium → Low. */
export const IMPACT_ORDER: readonly CalendarImpact[] = [
    'High',
    'Medium',
    'Low',
];

/** 임팩트 한국어 레이블 — 필터 칩·상세 뱃지 공통. */
export const IMPACT_LABELS: Record<CalendarImpact, string> = {
    High: '높음',
    Medium: '보통',
    Low: '낮음',
};
