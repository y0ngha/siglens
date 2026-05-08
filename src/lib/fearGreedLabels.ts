import type { FearGreedFactorKey, FearGreedLabel } from '@y0ngha/siglens-core';

/**
 * Score boundary thresholds for the 5-stage sentiment classifier — single
 * source of truth shared between FearGreedGroupBar and FearGreedComparisonGauges.
 *
 * **반드시 `@y0ngha/siglens-core`의 `FEAR_GREED_LABEL_CUTOFFS`와 동기 유지** —
 * 원본 정의: `node_modules/@y0ngha/siglens-core/dist/domain/indicators/fearGreed/composition.ts`
 * (`labelOf` 함수가 사용). 현재 siglens-core 0.8.0은 이 상수를 public barrel에서
 * export하지 않으므로 로컬 복제만 가능. core가 export하면 직접 import로 교체.
 *
 * Semantics: [0, EXTREME_FEAR_MAX) → EXTREME_FEAR, [EXTREME_FEAR_MAX, FEAR_MAX)
 * → FEAR, [FEAR_MAX, NEUTRAL_MAX) → NEUTRAL, [NEUTRAL_MAX, GREED_MAX) → GREED,
 * [GREED_MAX, 100] → EXTREME_GREED.
 */
export const FEAR_GREED_SCORE_BOUNDARIES = {
    EXTREME_FEAR_MAX: 25,
    FEAR_MAX: 45,
    NEUTRAL_MAX: 55,
    GREED_MAX: 75,
} as const;

/** confidence === 'normal' 표시 라벨 — Hero/Card footer 양쪽에서 동일 사용. */
export const CONFIDENCE_NORMAL_LABEL = '정상 산출';
/** confidence === 'limited' 표시 라벨 — sampleSize 부족 시 표기. */
export const CONFIDENCE_LIMITED_LABEL = '신뢰도 제한';

/**
 * Factor key → 한글 표시 라벨. UI는 이 객체로 일관 표시한다.
 *
 * `poc_distance: 'POC 거리(60bar)'`의 `60`은 `@y0ngha/siglens-core`의
 * `POC_WINDOW_DEFAULT`(`fearGreed/factors.ts`)와 동기 유지가 필요한 값. core가
 * 이 창 크기를 변경하면 이 라벨도 동반 업데이트. core가 public barrel에서
 * 상수를 export하면 직접 import로 치환.
 */
export const FACTOR_LABEL: Record<FearGreedFactorKey, string> = {
    volume_z: '거래량 z (방향성)',
    buysell_imbalance: 'Buy/Sell 불균형',
    poc_distance: 'POC 거리(60bar)',
    ma200_distance: 'MA200 거리',
    range_position: '52w 위치',
};

/** 5단계 sentiment label → 한글 표시 */
export const SENTIMENT_LABEL_TEXT: Record<FearGreedLabel, string> = {
    EXTREME_FEAR: '극공포',
    FEAR: '공포',
    NEUTRAL: '중립',
    GREED: '탐욕',
    EXTREME_GREED: '극탐욕',
};

// Locale-aware formatters hoisted to module scope — Intl.NumberFormat instances
// are expensive to construct, so we reuse one per precision tier.
const PERCENT_1_DP_FORMAT = new Intl.NumberFormat('ko-KR', {
    style: 'percent',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
});

const PERCENT_2_DP_FORMAT = new Intl.NumberFormat('ko-KR', {
    style: 'percent',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
});

const VOLUME_Z_FORMAT = new Intl.NumberFormat('ko-KR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
});

/** Raw value 표시 포맷터 — UI는 이 함수로 raw 값을 출력한다. */
export function formatFactorRaw(
    key: FearGreedFactorKey,
    rawValue: number
): string {
    switch (key) {
        case 'volume_z':
            return VOLUME_Z_FORMAT.format(rawValue);
        case 'buysell_imbalance':
        case 'range_position':
            return PERCENT_1_DP_FORMAT.format(rawValue);
        // poc_distance와 ma200_distance: 가격 거리 (%) — 동일 정밀도(소수 둘째 자리)
        case 'poc_distance':
        case 'ma200_distance':
            return PERCENT_2_DP_FORMAT.format(rawValue);
    }
}

/**
 * Confidence footer 표시 포맷터 — Hero footer(FearGreedPage)와 분석 탭 카드
 * footer(FearGreedCard) 양쪽에서 동일 형태로 사용한다.
 */
export function formatConfidenceFooter(
    sampleSize: number,
    confidence: 'normal' | 'limited'
): string {
    const label =
        confidence === 'normal'
            ? CONFIDENCE_NORMAL_LABEL
            : CONFIDENCE_LIMITED_LABEL;
    return `표본 ${sampleSize} — ${label}`;
}

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
