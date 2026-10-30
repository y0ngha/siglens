import type { Locale } from '@/shared/i18n/locales';
import { brandTitle } from '@/shared/lib/brandName';
import {
    buildBreadcrumbJsonLd,
    buildWebPageJsonLd,
    SITE_URL,
    type FaqItem,
    type SeoTranslator,
} from '@/shared/lib/seo';

/** {@link buildEconomyPageJsonLd} 입력. */
export interface EconomyPageJsonLdInput {
    /** 로케일 접두사가 없는 경로(`/economy`, `/economy/kr`). */
    readonly path: string;
    /** 브랜드 없는 제목 — breadcrumb 마디는 그대로, WebPage `name`은 로케일 브랜드를 붙인다. */
    readonly title: string;
    readonly description: string;
    readonly locale: Locale;
}

/** 거시 허브 한 장이 내는 WebPage·BreadcrumbList 구조화데이터 쌍. */
export interface EconomyPageJsonLd {
    readonly webPage: Record<string, unknown>;
    readonly breadcrumb: Record<string, unknown>;
}

/**
 * `/economy`·`/economy/kr`의 WebPage + BreadcrumbList. 데이터가 있는 렌더에서만 부른다 —
 * noindex degrade 렌더에서 "이 URL이 정식 문서"라고 주장하지 않게 하는 것은 호출부 몫이다.
 * `dateModified`는 싣지 않는다 — 빌드 시각에 고정된 값은 ISR 재생성 주기를 반영하지 못한다.
 * breadcrumb 마디 이름은 화면 `<Breadcrumb>`와 같은 `title`이다(다르면 구글이 마크업을 무시한다).
 */
export function buildEconomyPageJsonLd({
    path,
    title,
    description,
    locale,
}: EconomyPageJsonLdInput): EconomyPageJsonLd {
    const url = `${SITE_URL}${path}`;
    return {
        webPage: buildWebPageJsonLd({
            url,
            name: brandTitle(title, locale),
            description,
            locale,
        }),
        breadcrumb: buildBreadcrumbJsonLd([{ name: title, url }], locale),
    };
}

/**
 * `/economy` FAQ 원문 — FAQPage JSON-LD와 화면 `<FaqSection>`의 단일 소스(4건).
 *
 * 모듈 상수가 아니라 빌더인 이유: 한국어 리터럴이면 `/en/economy`가 영어 페이지에 한국어
 * FAQ 리치 스니펫을 실어 보낸다. 마지막 항목만 갱신 주기(`revalidateHours`)를 값으로 받고,
 * 나머지는 추가 값을 무시한다.
 */
export function buildEconomyFaq(
    t: SeoTranslator,
    revalidateHours: number
): readonly FaqItem[] {
    return [0, 1, 2, 3].map(i => ({
        question: t(`economy.us.faq${i}q`),
        answer: t(`economy.us.faq${i}a`, { v0: revalidateHours }),
    }));
}

/** `/economy/kr` FAQ 원문 — FAQPage JSON-LD와 화면 `<dl>`의 단일 소스(3건). */
export function buildEconomyKrFaq(t: SeoTranslator): readonly FaqItem[] {
    return [0, 1, 2].map(i => ({
        question: t(`economy.kr.faq${i}q`),
        answer: t(`economy.kr.faq${i}a`),
    }));
}
