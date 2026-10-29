import type { Locale } from '@/shared/i18n/locales';
import { brandTitle } from '@/shared/lib/brandName';
import {
    buildBreadcrumbJsonLd,
    buildWebPageJsonLd,
    clampSeoDescription,
    type SeoTranslator,
} from '@/shared/lib/seo';
import { SYMBOLS_PAGE_URL } from './symbolsUrls';

/** `<title>`·화면 제목의 짧은 이름(자산군 꼬리표 없음). */
export function symbolsTitle(t: SeoTranslator): string {
    return t('symbols.title');
}

/** 브랜드를 붙인 제목 — 소셜 카드와 WebPage JSON-LD `name`이 쓴다. */
export function symbolsFullTitle(t: SeoTranslator, locale: Locale): string {
    return brandTitle(symbolsTitle(t), locale);
}

/** 메타·JSON-LD 공통 설명 — SERP 길이로 잘라 둘이 같은 문구를 낸다. */
export function symbolsDescription(t: SeoTranslator): string {
    return clampSeoDescription(t('symbols.description'));
}

/**
 * `/symbols`의 `WebPage`·`BreadcrumbList` JSON-LD.
 *
 * `heading`은 화면 h1·브레드크럼 마디와 같은 짧은 제목이어야 한다 — `BreadcrumbList`의
 * `name`이 화면에 보이는 마디와 달라지면 구글이 마크업을 무시한다. `ItemList`는 싣지
 * 않는다: 416개 항목이면 JSON-LD만 50KB 가까이(근사치 —
 * 재려면 항목 수를 센 뒤 `JSON.stringify(ItemList).length`를 잰다) 늘어나는데, 크롤러가 얻어야 하는 것은
 * 링크 자체이고 그건 이미 `<a>`로 있다.
 */
export function buildSymbolsJsonLd(
    t: SeoTranslator,
    locale: Locale,
    heading: string
) {
    return {
        webPageJsonLd: buildWebPageJsonLd({
            url: SYMBOLS_PAGE_URL,
            name: symbolsFullTitle(t, locale),
            description: symbolsDescription(t),
            locale,
        }),
        breadcrumbJsonLd: buildBreadcrumbJsonLd(
            [{ name: heading, url: SYMBOLS_PAGE_URL }],
            locale
        ),
    };
}
