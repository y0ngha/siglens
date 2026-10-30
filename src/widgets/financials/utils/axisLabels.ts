/**
 * 재무 4축의 표시 순서와 `shared.enumLabel` 카탈로그 키 조회.
 */
import type { FinancialsAxis } from '@y0ngha/siglens-core';
import { AXIS_LABEL_KEY } from '@/entities/seo-snapshot/lib/financialsContent';

/** 스코어카드가 축 카드를 그리는 순서. */
export const SCORECARD_AXES: readonly FinancialsAxis[] = [
    'growth',
    'quality',
    'solvency',
    'cash',
];

/**
 * 축 → `shared.enumLabel` 키. 맵은 SSR 스냅샷 프로즈와 같은 정의를 쓴다 — 두 화면의 축 제목이
 * 갈라지지 않게 한 곳에서만 정의한다.
 *
 * 소비하는 `.tsx`는 이 키를 자기 파일의 번역자에 직접 넘겨야 한다(`tLabel(axisLabelKey(axis))`) —
 * extract.mjs의 동적 키 탐지는 번역자를 직접 호출하는 파일만 보므로, 인자로 전달만 하면
 * `shared.enumLabel`이 이 라우트의 클라이언트 번들에서 빠진다.
 */
export function axisLabelKey(axis: FinancialsAxis): string {
    return AXIS_LABEL_KEY[axis];
}
