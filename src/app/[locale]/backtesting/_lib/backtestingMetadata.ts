import { getTranslations } from 'next-intl/server';
import type { Metadata } from 'next';
import { resolveLocale } from '@/shared/i18n/locales';
import { brandName, brandTitle } from '@/shared/lib/brandName';
import { OG_IMAGE_HEIGHT, OG_IMAGE_WIDTH } from '@/shared/lib/og';
import {
    backtestingDescription,
    backtestingTitle,
    BACKTESTING_KEYWORDS,
    BACKTESTING_URL,
    localizedAbsoluteUrl,
} from '@/shared/lib/seo';
import {
    localeAlternatesFrom,
    localeOpenGraph,
} from '@/shared/lib/seoAlternates';
import { buildTwitterMetadata } from '@/shared/lib/twitterMetadata';

/**
 * `/backtesting` 라우트의 `generateMetadata` 본체. `robots`는 로케일 레이아웃이 선언한
 * `localePageRobots`를 그대로 상속한다.
 */
export async function buildBacktestingMetadata(
    params: Promise<{ locale: string }>
): Promise<Metadata> {
    const locale = resolveLocale((await params).locale);
    const tSeo = await getTranslations({
        locale,
        namespace: 'shared.seo',
    });
    const description = backtestingDescription(tSeo);
    const fullTitle = brandTitle(backtestingTitle(tSeo), locale);
    return {
        title: { absolute: fullTitle },
        description,
        keywords: BACKTESTING_KEYWORDS,
        alternates: await localeAlternatesFrom(params, '/backtesting'),
        openGraph: {
            title: fullTitle,
            description,
            url: localizedAbsoluteUrl(BACKTESTING_URL, locale),
            siteName: brandName(locale),
            ...localeOpenGraph(locale),
            type: 'website',
            images: [
                {
                    url: '/og-image.png',
                    width: OG_IMAGE_WIDTH,
                    height: OG_IMAGE_HEIGHT,
                    alt: tSeo('backtestingOgAlt', { v0: brandName(locale) }),
                },
            ],
        },
        twitter: buildTwitterMetadata({
            title: fullTitle,
            description,
            images: ['/og-image.png'],
        }),
    };
}
