import type { FearGreedLabel } from '@y0ngha/siglens-core';

/**
 * Score boundary thresholds for the 5-stage sentiment classifier — single
 * source of truth for fear-greed score → label classification on the siglens
 * app side. Mirrors `@y0ngha/siglens-core`의 `FEAR_GREED_LABEL_CUTOFFS` /
 * `labelOf` 동작.
 *
 * 원본 정의: `node_modules/@y0ngha/siglens-core/dist/domain/indicators/fearGreed/composition.ts`.
 * 현재 siglens-core 0.8.0은 이 상수를 public barrel에서 export하지 않으므로
 * 로컬 복제만 가능. core가 export하면 직접 import로 교체.
 *
 * Semantics: [0, EXTREME_FEAR_MAX) → EXTREME_FEAR, [EXTREME_FEAR_MAX, FEAR_MAX)
 * → FEAR, [FEAR_MAX, NEUTRAL_MAX) → NEUTRAL, [NEUTRAL_MAX, GREED_MAX) → GREED,
 * [GREED_MAX, 100] → EXTREME_GREED.
 *
 * 소비자: FearGreedGroupBar, FearGreedComparisonGauges, FearGreedGauge
 * SEGMENTS palette, fear-greed/page.tsx FAQ 텍스트 등.
 */
export const FEAR_GREED_SCORE_BOUNDARIES = {
    EXTREME_FEAR_MAX: 25,
    FEAR_MAX: 45,
    NEUTRAL_MAX: 55,
    GREED_MAX: 75,
} as const;

/**
 * Score → 5단계 sentiment label classifier. FearGreedHistoryPoint.label이
 * 비어 있을 때의 fallback과 score 기반 색상 매핑 양쪽에서 사용한다. 경계값은
 * `FEAR_GREED_SCORE_BOUNDARIES`와 `@y0ngha/siglens-core`의 labelOf와 일치.
 */
export function classifyScore(score: number): FearGreedLabel {
    if (score < FEAR_GREED_SCORE_BOUNDARIES.EXTREME_FEAR_MAX)
        return 'EXTREME_FEAR';
    if (score < FEAR_GREED_SCORE_BOUNDARIES.FEAR_MAX) return 'FEAR';
    if (score < FEAR_GREED_SCORE_BOUNDARIES.NEUTRAL_MAX) return 'NEUTRAL';
    if (score < FEAR_GREED_SCORE_BOUNDARIES.GREED_MAX) return 'GREED';
    return 'EXTREME_GREED';
}
