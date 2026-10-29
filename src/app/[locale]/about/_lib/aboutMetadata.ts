import { getTranslations } from 'next-intl/server';
import type { Metadata } from 'next';
import { resolveLocale } from '@/shared/i18n/locales';
import { brandName } from '@/shared/lib/brandName';
import {
    ABOUT_PATH,
    aboutDescription,
    aboutFullTitle,
} from '@/shared/lib/legal';
import { OG_IMAGE_HEIGHT, OG_IMAGE_WIDTH } from '@/shared/lib/og';
import { localizedAbsoluteUrl } from '@/shared/lib/seo';
import {
    localeAlternatesFrom,
    localeOpenGraph,
    localePageRobots,
} from '@/shared/lib/seoAlternates';
import { buildTwitterMetadata } from '@/shared/lib/twitterMetadata';
import { ABOUT_PAGE_URL } from './aboutJsonLd';

/**
 * `/about` 라우트의 `generateMetadata` 본체.
 *
 * 메타 타이틀이 이미 브랜드(ko는 `시그렌즈(SIGLENS)`)로 시작하므로 레이아웃 템플릿
 * (ko `%s | 시그렌즈`)을 타면 브랜드가 두 번 붙어 SERP 폭만 먹는다 — `absolute`로 끊는다.
 */
export async function buildAboutMetadata(
    params: Promise<{ locale: string }>
): Promise<Metadata> {
    const locale = resolveLocale((await params).locale);
    const tSeo = await getTranslations({
        locale,
        namespace: 'shared.seo',
    });
    const title = aboutFullTitle(tSeo);
    const description = aboutDescription(tSeo);
    return {
        title: { absolute: title },
        description,
        robots: localePageRobots(locale),
        alternates: await localeAlternatesFrom(params, ABOUT_PATH),
        openGraph: {
            type: 'article',
            siteName: brandName(locale),
            title,
            description,
            url: localizedAbsoluteUrl(ABOUT_PAGE_URL, locale),
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
