/**
 * `/methodology` 본문 섹션의 순서와 제목.
 *
 * 목차와 각 섹션의 `<h2>`가 같은 제목을 쓰도록 한 곳에서 만든다.
 */
import type { MethodologyTranslator } from '../types';

/**
 * 섹션 id. 배열 순서가 곧 목차와 본문의 순서다. id는 `<h2>`의 앵커라 바꾸면 안 된다 —
 * 종목 페이지의 출처 고지(`AnalysisProvenanceNote`)가 `#data`·`#ai`·`#fear-greed`를 건다.
 */
export const METHODOLOGY_SECTION_IDS = [
    'overview',
    'data',
    'indicators',
    'fear-greed',
    'ai',
    'backtesting',
    'limits',
    'corrections',
    'changelog',
] as const;

/** 본문 섹션 하나의 id. */
export type MethodologySectionId = (typeof METHODOLOGY_SECTION_IDS)[number];

/**
 * 섹션 id → 제목. 키를 리터럴로 부르므로 카탈로그 스캔이 키를 그대로 찾는다.
 */
export function methodologySectionTitles(
    t: MethodologyTranslator
): Readonly<Record<MethodologySectionId, string>> {
    return {
        overview: t('overview.title'),
        data: t('data.title'),
        indicators: t('indicators.title'),
        'fear-greed': t('fearGreed.title'),
        ai: t('ai.title'),
        backtesting: t('backtesting.title'),
        limits: t('limits.title'),
        corrections: t('corrections.title'),
        changelog: t('changelog.title'),
    };
}
