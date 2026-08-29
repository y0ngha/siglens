import type { Locale } from '@/shared/i18n/locales';

/** titleKo/titleEn을 함께 들고 있는 최소 구조 — 뉴스 카드/JSON-LD 등 여러 로우 타입이 구조적으로 호환된다. */
export interface NewsTitleSource {
    titleKo: string | null;
    titleEn: string;
    /** 서버가 사이드카에서 해석한 요청 로케일 제목(`NewsDisplayItem` 참조). */
    titleLocalized?: string;
}

/**
 * 뉴스 헤드라인 표시 언어 결정.
 *
 * 예전에는 로케일과 무관하게 `titleKo ?? titleEn`으로 **항상 한국어를
 * 우선**했다 — `/en`·`/ja`·`/zh` 뉴스 화면이 원문 영어 제목이 있어도 한국어
 * 헤드라인을 보여줬다.
 *
 * ko가 아닌 로케일에서는 `titleEn`이 비어 있지 않은 한 그것을 우선한다 —
 * 데이터 누락(빈 `titleEn`)이 빈 헤드라인보다는 낫다는 원칙으로, 그 경우
 * `titleKo`로 폴백한다. ko 로케일은 기존 동작 그대로 `titleKo`를 우선한다.
 *
 * `titleEn`이 타입상 `string`이어도 degrade된 DB 행은 `null`/`undefined`로
 * 새어 들어올 수 있다(옛 `titleKo ?? titleEn ?? ''` 호출부가 방어하던
 * 경우) — `?.length`로 같은 안전성을 유지한다.
 */
export function resolveNewsTitle(
    item: NewsTitleSource,
    locale: Locale
): string {
    // 사이드카 해석값이 최우선 — ja/zh는 원본 컬럼에 담길 자리가 아예 없다.
    // 서버가 이미 폴백 체인을 적용한 결과라 여기서 다시 판단하지 않는다.
    if (item.titleLocalized !== undefined) return item.titleLocalized;
    if (locale !== 'ko' && (item.titleEn?.length ?? 0) > 0) {
        return item.titleEn;
    }
    return item.titleKo ?? item.titleEn ?? '';
}

/** `summaryKo`/`bodyKo`를 들고 있는 최소 구조. */
export interface NewsBodySource {
    summaryKo: string | null;
    bodyKo: string | null;
    summaryLocalized?: string;
    bodyLocalized?: string;
}

/**
 * 카드 요약 표시 언어 결정.
 *
 * 제목과 달리 **영어 원문 요약 컬럼이 없다** — 요약은 AI가 한국어로만 만든다.
 * 그래서 사이드카에 번역이 없으면 한국어를 그대로 쓴다(빈 카드보다 낫다).
 * 사이드카가 채워지면 그 값이 이긴다.
 */
export function resolveNewsSummary(item: NewsBodySource): string | null {
    return item.summaryLocalized ?? item.summaryKo;
}

/** 카드 본문 표시 언어 결정 — `resolveNewsSummary`와 같은 규칙. */
export function resolveNewsBody(item: NewsBodySource): string | null {
    return item.bodyLocalized ?? item.bodyKo;
}
