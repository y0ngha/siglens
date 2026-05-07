import type { FearGreedFactorKey, FearGreedLabel } from '@y0ngha/siglens-core';

/**
 * Score boundary thresholds for the 5-stage sentiment classifier — single
 * source of truth shared between FearGreedGroupBar and FearGreedComparisonGauges.
 * Must match `@y0ngha/siglens-core`'s `labelOf` and the gauge SEGMENTS.
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

/** Factor key → 한글 표시 라벨. UI는 이 객체로 일관 표시한다. */
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
