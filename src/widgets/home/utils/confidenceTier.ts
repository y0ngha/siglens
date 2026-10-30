/**
 * 스킬 신뢰도 점수의 등급 경계와 등급별 표시 클래스.
 *
 * 막대 색과 툴팁 카피가 **같은 상수**에서 나와야 둘이 어긋나지 않는다.
 */

export type ConfidenceTier = 'low' | 'medium' | 'high';

/**
 * `@y0ngha/siglens-core`의 `HIGH_CONFIDENCE_WEIGHT` 로컬 미러.
 *
 * core의 indicator constants 모듈은 60개 이상의 상수를 한 파일에 묶고 있어 landing
 * chunk에서 tree-shaking이 실패하면 unused JS가 끌려온다(PSI unused-javascript,
 * lcp-discovery). 단일 상수를 인라인해 그 의존을 끊는다. core 값과의 일치는
 * 단위 테스트가 검증한다. 추적: #468 (core가 constants를 관심사별로 분리하면 직접
 * import로 복귀).
 */
export const HIGH_CONFIDENCE_WEIGHT = 0.8;

/**
 * 보통/낮음 경계. core가 client entrypoint에 confidence 경계/helper를 노출하면
 * 이 미러를 삭제하고 import로 통합한다(`HIGH_CONFIDENCE_WEIGHT`와 함께).
 */
export const MEDIUM_CONFIDENCE_WEIGHT = 0.5;

/** 점수 → 등급. 경계값은 상위 등급에 속한다(`>=`). */
export function getConfidenceTier(weight: number): ConfidenceTier {
    if (weight >= HIGH_CONFIDENCE_WEIGHT) return 'high';
    if (weight >= MEDIUM_CONFIDENCE_WEIGHT) return 'medium';
    return 'low';
}

/** 등급별 막대 배경 클래스 — 등급을 추가하면 컴파일러가 여기를 짚는다. */
export const CONFIDENCE_BAR_CLASS: Record<ConfidenceTier, string> = {
    high: 'bg-chart-bullish',
    medium: 'bg-ui-warning',
    low: 'bg-secondary-500',
};

/**
 * 툴팁 카피에 ICU 인자로 주입하는 경계 퍼센트(`{low}`=보통 시작, `{high}`=높음 시작).
 * `Math.round`가 `0.8 * 100 = 80.00000000000001` 같은 부동소수점 잔차를 흡수한다.
 */
export const CONFIDENCE_THRESHOLD_PERCENTS = {
    low: Math.round(MEDIUM_CONFIDENCE_WEIGHT * 100),
    high: Math.round(HIGH_CONFIDENCE_WEIGHT * 100),
} as const;
