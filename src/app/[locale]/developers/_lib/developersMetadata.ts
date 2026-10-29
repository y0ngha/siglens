import { getTranslations } from 'next-intl/server';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { isPublicApiEnabled } from '@/shared/api/publicApiEnabled';
import { DEVELOPERS_PATH } from '@/shared/config/publicApi';
import { resolveLocale } from '@/shared/i18n/locales';
import { brandName } from '@/shared/lib/brandName';
import { OG_IMAGE_HEIGHT, OG_IMAGE_WIDTH } from '@/shared/lib/og';
import { localizedAbsoluteUrl } from '@/shared/lib/seo';
import {
    localeAlternatesFrom,
    localeOpenGraph,
    localePageRobots,
} from '@/shared/lib/seoAlternates';
import { buildTwitterMetadata } from '@/shared/lib/twitterMetadata';
import { DEVELOPERS_PAGE_URL, developersFullTitle } from './developersSeo';

/**
 * `/developers` 라우트의 `generateMetadata` 본체.
 *
 * 공개 API 출시 전에는 페이지가 없다 — 메타데이터 단계에서도 404로 끊어 noindex 404가
 * 나가게 한다. 색인은 `STATIC_INDEXABLE_LOCALES`(ko)만이며 판정은 `localeRobots`가 소유한다.
 */
export async function buildDevelopersMetadata(
    params: Promise<{ locale: string }>
): Promise<Metadata> {
    if (!isPublicApiEnabled()) notFound();
    const locale = resolveLocale((await params).locale);
    const tSeo = await getTranslations({ locale, namespace: 'shared.seo' });
    const title = developersFullTitle(tSeo);
    const description = tSeo('developers.description');
    return {
        title: { absolute: title },
        description,
        robots: localePageRobots(locale),
        alternates: await localeAlternatesFrom(params, DEVELOPERS_PATH),
        openGraph: {
            type: 'website',
            siteName: brandName(locale),
            title,
            description,
            url: localizedAbsoluteUrl(DEVELOPERS_PAGE_URL, locale),
            ...localeOpenGraph(locale),
            images: [
                {
                    url: '/og-image.png',
                    width: OG_IMAGE_WIDTH,
                    height: OG_IMAGE_HEIGHT,
                    alt: title,
                },
            ],
        },
        twitter: buildTwitterMetadata({
            card: 'summary',
            title,
            description,
            images: ['/og-image.png'],
        }),
    };
}
