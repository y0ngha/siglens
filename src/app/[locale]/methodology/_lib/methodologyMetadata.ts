import { getTranslations } from 'next-intl/server';
import type { Metadata } from 'next';
import { resolveLocale } from '@/shared/i18n/locales';
import { brandName } from '@/shared/lib/brandName';
import {
    METHODOLOGY_PATH,
    methodologyDescription,
    methodologyFullTitle,
} from '@/shared/lib/legal';
import { OG_IMAGE_HEIGHT, OG_IMAGE_WIDTH } from '@/shared/lib/og';
import { localizedAbsoluteUrl } from '@/shared/lib/seo';
import {
    localeAlternatesFrom,
    localeOpenGraph,
    localePageRobots,
} from '@/shared/lib/seoAlternates';
import { buildTwitterMetadata } from '@/shared/lib/twitterMetadata';
import { METHODOLOGY_PAGE_URL } from './methodologyUrls';

/**
 * `/methodology` 라우트의 `generateMetadata` 본체.
 *
 * 메타 타이틀이 이미 브랜드로 시작하므로 레이아웃 템플릿(ko `%s | 시그렌즈`)을 타면
 * 브랜드가 두 번 붙는다 — `absolute`로 끊는다(`/about`과 같다). 색인은
 * `STATIC_INDEXABLE_LOCALES`(ko)만이며 판정은 `localeRobots`가 소유한다.
 */
export async function buildMethodologyMetadata(
    params: Promise<{ locale: string }>
): Promise<Metadata> {
    const locale = resolveLocale((await params).locale);
    const tSeo = await getTranslations({
        locale,
        namespace: 'shared.seo',
    });
    const title = methodologyFullTitle(tSeo);
    const description = methodologyDescription(tSeo);
    return {
        title: { absolute: title },
        description,
        robots: localePageRobots(locale),
        alternates: await localeAlternatesFrom(params, METHODOLOGY_PATH),
        openGraph: {
            type: 'article',
            siteName: brandName(locale),
            title,
            description,
            url: localizedAbsoluteUrl(METHODOLOGY_PAGE_URL, locale),
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
