import type { SnapshotConfidence } from '@/shared/lib/types';
import type { FearGreedFactorKey, FearGreedLabel } from '@y0ngha/siglens-core';
import { POC_WINDOW_DEFAULT } from '@y0ngha/siglens-core';

/** confidence === 'normal' 표시 라벨 — Hero/Card footer 양쪽에서 동일 사용. */
export const CONFIDENCE_NORMAL_LABEL = '정상 산출';
/** confidence === 'limited' 표시 라벨 — sampleSize 부족 시 표기. */
export const CONFIDENCE_LIMITED_LABEL = '신뢰도 제한';

/**
 * Factor key → 한글 표시 라벨. UI는 이 객체로 일관 표시한다.
 *
 * `poc_distance` 라벨의 창 크기는 `@y0ngha/siglens-core`의 `POC_WINDOW_DEFAULT`를
 * 직접 보간하므로 core가 값을 바꾸면 자동으로 반영된다.
 */
export const FACTOR_LABEL: Record<FearGreedFactorKey, string> = {
    volume_z: '거래량 z (방향성)',
    buysell_imbalance: 'Buy/Sell 불균형',
    poc_distance: `POC 거리(${POC_WINDOW_DEFAULT}bar)`,
    ma200_distance: 'MA200 거리',
    range_position: '52주 위치',
};

/** 5단계 sentiment label → 한글 표시 */
export const SENTIMENT_LABEL_TEXT: Record<FearGreedLabel, string> = {
    EXTREME_FEAR: '극심한 공포',
    FEAR: '공포',
    NEUTRAL: '중립',
    GREED: '탐욕',
    EXTREME_GREED: '극심한 탐욕',
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
    confidence: SnapshotConfidence
): string {
    const label =
        confidence === 'normal'
            ? CONFIDENCE_NORMAL_LABEL
            : CONFIDENCE_LIMITED_LABEL;
    return `표본 ${sampleSize} — ${label}`;
}
