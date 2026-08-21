import type { SnapshotConfidence } from '@/shared/lib/types';
import type { EnumLabelTranslator } from '@/shared/lib/enumLabelTranslator';
import {
    type FearGreedFactorKey,
    type FearGreedLabel,
    type FearGreedWarning,
} from '@y0ngha/siglens-core';

/**
 * confidence 표시 **키** — `shared.lib.fearGreed` 네임스페이스.
 * Hero/Card footer 양쪽에서 같은 키를 쓴다.
 */
export const CONFIDENCE_NORMAL_KEY = 'confidenceNormal';
/** sampleSize 부족 시 표기. */
export const CONFIDENCE_LIMITED_KEY = 'confidenceLimited';

/**
 * Self-norm 경고 문구 — chronic 사이클 종목에서 점수가 절대 강도가 아니라 자기 분포
 * 대비 상대 위치를 가리킨다는 안내.
 *
 * 여기 두는 이유: 클라이언트 배지(`SelfNormWarningBadge`)와 서버 렌더 요약
 * (`FearGreedFactsSummary`)이 **같은 문구**를 써야 하는데, 상수가 `'use client'`
 * 컴포넌트 파일에 있으면 서버 컴포넌트가 그 모듈을 통째로 끌어온다.
 */
export const WARNING_TEXT_KEY: Record<NonNullable<FearGreedWarning>, string> = {
    CHRONIC_WEAKNESS: 'warningChronicWeakness',
    CHRONIC_STRENGTH: 'warningChronicStrength',
};

/**
 * 5단계 sentiment label → `shared.enumLabel` 카탈로그 키.
 *
 * export하는 이유: `'use client'` 트리에 닿는 소비자(`FearGreedHeaderChip`/
 * `FearGreedGauge`/`FearGreedFactsSummary`)는 `sentimentLabelText(label, t)`처럼
 * 번역자를 **인자로 전달**만 하면 `scripts/i18n/extract.mjs`의 동적 키 탐지
 * (그 파일 안에서 번역자를 직접 호출하는 패턴만 봄)가 걸리지 않아
 * `messages/_meta/clientKeys.json`에 `shared.enumLabel`이 안 실린다 — 런타임
 * `MISSING_MESSAGE`로만 드러난다. 그런 소비자는 이 맵을 직접 import해
 * `t(SENTIMENT_LABEL_KEY[label])`로 **그 파일 안에서 직접 호출**한다.
 */
export const SENTIMENT_LABEL_KEY: Record<FearGreedLabel, string> = {
    EXTREME_FEAR: 'fearGreed.extremeFear',
    FEAR: 'fearGreed.fear',
    NEUTRAL: 'fearGreed.neutral',
    GREED: 'fearGreed.greed',
    EXTREME_GREED: 'fearGreed.extremeGreed',
};

/**
 * FearGreedLabel → 로케일별 표시 라벨. `t`는 필수 인자다 — 기본값을 두면 호출부가
 * 조용히 `t`를 누락해도 컴파일이 통과하고, 그 결과 라벨이 `fearGreed.extremeFear`
 * 같은 raw 카탈로그 키 문자열로 렌더된다(§design EnumLabelTranslator required-param).
 */
export function sentimentLabelText(
    label: FearGreedLabel,
    t: EnumLabelTranslator
): string {
    return t(SENTIMENT_LABEL_KEY[label]);
}

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
 * Confidence footer의 라벨 **키**를 고른다.
 *
 * 조립(`표본 {v0} — {v1}`)까지 여기서 하지 않는 이유: 이 모듈은 번역자를
 * **인자로 받으므로** 추출기가 통째로 건너뛴다(`translatorNamespace.size === 0`).
 * 여기서 `t('confidenceFooter')`를 부르면 그 키가 클라이언트 페이로드에 안 실려
 * `/en/AAPL/fear-greed`의 footer가 키 문자열을 그대로 렌더한다 — 실제로 종목
 * 페이지 h1에서 한 번 낸 결함이다. 그래서 `t()` 리터럴 호출은 번역자를 선언한
 * 소비 파일에서만 한다.
 */
export function confidenceLabelKey(confidence: SnapshotConfidence): string {
    return confidence === 'normal'
        ? CONFIDENCE_NORMAL_KEY
        : CONFIDENCE_LIMITED_KEY;
}
