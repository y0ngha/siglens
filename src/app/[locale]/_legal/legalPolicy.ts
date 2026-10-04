import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { cache } from 'react';
import { getActiveTerms, type TermsRecord } from '@/entities/terms/api';
import type { TermsKind } from '@/shared/db/constants';
import { isDatabaseMissingAtBuild } from '@/shared/db/config';
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
    localePageRobots,
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
 * 활성 약관 조회 결과.
 *
 *  - `ready`: 본문이 있다.
 *  - `missing`: DB는 읽었는데 활성 버전이 없다 → 페이지는 404.
 *  - `unavailable`: **DB 없이 도는 빌드**라 본문을 읽을 수 없다 → 안내문 fallback.
 */
export type LegalTermsLoad =
    | { readonly status: 'ready'; readonly terms: TermsRecord }
    | { readonly status: 'missing' }
    | { readonly status: 'unavailable' };

/**
 * `generateMetadata`와 페이지 본문이 **같은 결과**를 보게 하는 요청 스코프 조회.
 *
 * 운영 DB가 사설 RDS라 배포 빌드(GitHub Actions 러너)에는 DB가 없다. 그 빌드에서
 * `notFound()`(404가 구워진다)나 throw(빌드 실패)로 가면 안 되고, 빈 본문을 굳혀도
 * 안 된다 — 그래서 DB를 건드리지 않고 `unavailable`을 돌려 안내문 + 짧은 revalidate
 * 페이지를 만들게 한다. 런타임과 DB가 있는 빌드는 그대로 `getActiveTerms`를 부르며,
 * 그 쪽 DB 오류는 삼키지 않고 던진다(로컬/E2E 빌드가 빈 약관을 굽지 않게).
 */
export const loadLegalTerms = cache(
    async (kind: TermsKind, locale: Locale): Promise<LegalTermsLoad> => {
        if (isDatabaseMissingAtBuild()) return { status: 'unavailable' };
        const terms = await getActiveTerms(kind, locale);
        return terms === null
            ? { status: 'missing' }
            : { status: 'ready', terms };
    }
);

/**
 * 약관·방침 라우트의 `generateMetadata` 본체.
 *
 * 활성 버전이 없으면 이 URL은 404다(페이지가 `notFound()`를 던진다). 본문을 못 읽은
 * 빌드 fallback도 마찬가지다. 그 상태를 색인 후보로 광고하지 않는다 — canonical을
 * 비우고 noindex.
 */
export async function legalPolicyMetadata(
    params: Promise<{ locale: string }>,
    policy: LegalPolicy
): Promise<Metadata> {
    const locale = resolveLocale((await params).locale);
    const tSeo = await getTranslations({ locale, namespace: 'shared.seo' });
    const { status } = await loadLegalTerms(policy.kind, locale);
    const indexable = status === 'ready';
    const fullTitle = policy.fullTitle(tSeo);
    const description = policy.description(tSeo);
    return {
        title: policy.title(tSeo),
        description,
        robots: indexable
            ? localePageRobots(locale)
            : { index: false, follow: true },
        alternates: await localeAlternatesFrom(params, policy.path, {
            canonical: indexable ? undefined : null,
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
