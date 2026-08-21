/**
 * `content_translations`의 `entity`·`field` 값 레지스트리.
 *
 * 컬럼이 문자열이라 오타를 컴파일러가 못 잡는다 — 호출부는 반드시 이 상수를
 * 쓴다. 오타 하나면 그 필드의 번역이 **조용히 없는 것으로** 취급되고, 폴백이
 * 걸려 한국어가 나가므로 화면은 멀쩡해 보인다(테스트도 통과한다).
 */

/**
 * 번역 사이드카를 가진 원본 테이블.
 *
 * **읽는 경로가 있는 것만 넣는다.** 등록만 하고 아무도 읽지 않으면 백필과
 * AI 번역이 계속 돌면서 결과가 버려진다 — 화면은 멀쩡하고 테스트도 통과하므로
 * 아무도 눈치채지 못한다. `contentTranslationRegistry.test.ts`가 이를 강제한다.
 *
 * 의도적으로 **빠진** 것:
 * - `asset_translations`: 종목명은 비-ko에서 이미 영문 법인명(`assetInfo.name`)이
 *   나간다(`buildDisplayName`). 지수·ETF는 `shared.assetName` 메시지 카탈로그가
 *   덮는다. 사이드카가 이길 자리가 `name`이 빈 종목뿐이라 값이 없다.
 * - `economic_indicator_translations`: 지표명도 비-ko는 원본 영문을 그대로
 *   쓴다(`resolveIndicatorLabels`) — 한국어가 새지 않는다. 사이드카를 붙이면
 *   로케일마다 별도 `unstable_cache` 엔트리가 생겨 ISR write만 늘어난다.
 * - `seo_analysis_snapshots`·`shared_analyses`: 이 둘은 **행 자체가 로케일별로
 *   생성된다**(`locale` 컬럼). AI가 그 언어로 직접 분석을 쓰므로 번역할 원본이
 *   없다 — 사이드카는 겹치기만 하고 이길 일이 없다.
 */
export const TRANSLATABLE_ENTITY = {
    news: 'news',
    marketNews: 'market_news',
    notice: 'notices',
    terms: 'terms',
    economicCalendar: 'economic_calendar',
    profileDescription: 'profile_description_translations',
} as const;

export type TranslatableEntity =
    (typeof TRANSLATABLE_ENTITY)[keyof typeof TRANSLATABLE_ENTITY];

export const TRANSLATABLE_ENTITY_VALUES = Object.values(
    TRANSLATABLE_ENTITY
) as readonly TranslatableEntity[];

/**
 * 엔티티별 번역 대상 필드.
 *
 * 필드명은 **원본 컬럼명이 아니라 도메인 이름**이다 — 원본은 `title_ko`처럼
 * 로케일이 이름에 박혀 있어서 그대로 쓰면 `title_ko`의 일본어 번역이라는
 * 모순이 생긴다.
 */
export const CONTENT_FIELD = {
    news: { title: 'title', body: 'body', summary: 'summary' },
    marketNews: { title: 'title', body: 'body', summary: 'summary' },
    notice: { title: 'title', body: 'body', linkLabel: 'linkLabel' },
    terms: { body: 'body' },
    economicCalendar: { summary: 'summary', interpretation: 'interpretation' },
    profileDescription: { description: 'description' },
} as const;

/** 번역 출처 — 약관처럼 인간 번역이 필수인 문서를 가려내는 데 쓴다. */
export const TRANSLATION_SOURCE = {
    human: 'human',
    ai: 'ai',
} as const;

export type TranslationSource =
    (typeof TRANSLATION_SOURCE)[keyof typeof TRANSLATION_SOURCE];

export const TRANSLATION_SOURCE_VALUES = Object.values(
    TRANSLATION_SOURCE
) as readonly TranslationSource[];

export function isTranslationSource(
    value: string | null | undefined
): value is TranslationSource {
    return (
        typeof value === 'string' &&
        (TRANSLATION_SOURCE_VALUES as readonly string[]).includes(value)
    );
}
