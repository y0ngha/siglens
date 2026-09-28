import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { getActiveTerms } from '@/entities/terms/api';
import { resolveLocale, type Locale } from '@/shared/i18n/locales';
import { OG_IMAGE_HEIGHT, OG_IMAGE_WIDTH } from '@/shared/lib/og';
import {
    buildBreadcrumbJsonLd,
    buildWebPageJsonLd,
    localizedAbsoluteUrl,
    SITE_NAME,
    SITE_URL,
    type SeoTranslator,
} from '@/shared/lib/seo';
import {
    localeAlternatesFrom,
    localeOpenGraph,
    localeRobots,
} from '@/shared/lib/seoAlternates';

/**
 * `/terms`·`/privacy`가 서로 다른 부분 중 메타데이터·JSON-LD에 쓰이는 것.
 *
 * 두 라우트는 메타데이터와 구조화데이터가 **문서 종류만 빼고** 같다. 본문
 * (`*Content`)은 고지 블록이 서로 달라 각 라우트에 남긴다.
 */
export interface LegalPolicy {
    /** `terms` 테이블의 문서 종류. */
    readonly kind: 'tos' | 'privacy';
    /** 로케일 접두사 없는 경로(`TERMS_PATH`·`PRIVACY_PATH`). */
    readonly path: string;
    readonly title: (t: SeoTranslator) => string;
    readonly fullTitle: (t: SeoTranslator) => string;
    readonly description: (t: SeoTranslator) => string;
}

/**
 * 약관·방침 라우트의 `generateMetadata` 본체.
 *
 * 활성 버전이 없으면 이 URL은 404다(페이지가 `notFound()`를 던진다). 그 상태를
 * 색인 후보로 광고하지 않는다 — canonical을 비우고 noindex.
 */
export async function legalPolicyMetadata(
    params: Promise<{ locale: string }>,
    policy: LegalPolicy
): Promise<Metadata> {
    const locale = resolveLocale((await params).locale);
    const tSeo = await getTranslations({ locale, namespace: 'shared.seo' });
    const active = await getActiveTerms(policy.kind, locale);
    const fullTitle = policy.fullTitle(tSeo);
    const description = policy.description(tSeo);
    return {
        title: policy.title(tSeo),
        description,
        robots:
            active === null
                ? { index: false, follow: true }
                : localeRobots(locale),
        alternates: await localeAlternatesFrom(params, policy.path, {
            canonical: active === null ? null : undefined,
        }),
        openGraph: {
            type: 'article',
            siteName: SITE_NAME,
            title: fullTitle,
            description,
            url: localizedAbsoluteUrl(`${SITE_URL}${policy.path}`, locale),
            ...localeOpenGraph(locale),
            images: [
                {
                    url: '/og-image.png',
                    width: OG_IMAGE_WIDTH,
                    height: OG_IMAGE_HEIGHT,
                    alt: fullTitle,
                },
            ],
        },
        twitter: {
            card: 'summary',
            title: fullTitle,
            description,
            images: ['/og-image.png'],
        },
    };
}

/**
 * 문서의 `WebPage` JSON-LD.
 *
 * 모듈 스코프 상수였다 — 번역자도 로케일도 없는 자리라 JSON-LD가 항상
 * 한국어·기본 로케일 URL로 굳었다. 렌더 시점 함수로 둔다.
 */
export function legalPolicyWebPageJsonLd(
    policy: LegalPolicy,
    t: SeoTranslator,
    locale: Locale
): Record<string, unknown> {
    return buildWebPageJsonLd({
        url: `${SITE_URL}${policy.path}`,
        name: policy.fullTitle(t),
        description: policy.description(t),
        locale,
    });
}

export function legalPolicyBreadcrumbJsonLd(
    policy: LegalPolicy,
    t: SeoTranslator,
    locale: Locale
) {
    return buildBreadcrumbJsonLd(
        [{ name: policy.title(t), url: `${SITE_URL}${policy.path}` }],
        locale
    );
}
