import type { NewsSentiment } from '@y0ngha/siglens-core';
import type { EnumLabelTranslator } from './enumLabelTranslator';

/**
 * NewsSentiment → `shared.enumLabel` 카탈로그 키. 값 자체는 더 이상 한글이 아니다 —
 * `sentimentLabel`이 번역자로 조회한다.
 *
 * export하는 이유: `'use client'` 소비자는 `sentimentLabel(value, t)`처럼 번역자를
 * **인자로 전달**만 하면 `scripts/i18n/extract.mjs`의 동적 키 탐지(`\btLabel\(`
 * 같은 "그 파일 안에서 번역자를 직접 호출하는 패턴"만 봄)가 걸리지 않아
 * `messages/_meta/clientKeys.json`에 이 네임스페이스가 안 실린다 — 런타임
 * `MISSING_MESSAGE`로만 드러난다. 그런 소비자는 이 맵을 직접 import해
 * `t(SENTIMENT_LABEL_KEY[value])`로 **그 파일 안에서 직접 호출**한다
 * (`MarketNewsCard`/`MarketNewsDigest`/`EconomicCalendarGrid` 참고).
 */
export const SENTIMENT_LABEL_KEY: Record<NewsSentiment, string> = {
    bullish: 'sentiment.bullish',
    neutral: 'sentiment.neutral',
    bearish: 'sentiment.bearish',
};

export const SENTIMENT_CLASS: Record<NewsSentiment, string> = {
    bullish: 'bg-ui-success/10 text-ui-success-text',
    neutral: 'bg-secondary-700 text-secondary-300',
    bearish: 'bg-ui-danger/10 text-ui-danger-text',
};

/**
 * NewsSentiment → 로케일별 표시 라벨. `t`는 필수 인자다 — 기본값을 두면 호출부가
 * 조용히 `t`를 누락해도 컴파일이 통과하고, 그 결과 라벨이 `sentiment.bullish` 같은
 * raw 카탈로그 키 문자열로 렌더된다(§design EnumLabelTranslator required-param).
 */
export function sentimentLabel(
    value: NewsSentiment,
    t: EnumLabelTranslator
): string {
    return t(SENTIMENT_LABEL_KEY[value]);
}

/**
 * Type guard for {@link NewsSentiment}. Uses {@link SENTIMENT_LABEL_KEY}
 * (Record<NewsSentiment, string>) as the exhaustiveness source — if core adds a
 * new sentiment, the SENTIMENT_LABEL_KEY definition fails to compile, preventing
 * silent drift.
 */
export function isNewsSentiment(value: unknown): value is NewsSentiment {
    return typeof value === 'string' && value in SENTIMENT_LABEL_KEY;
}
