import type { Metadata } from 'next';
import {
    buildHubMetadata,
    localeAlternatesFrom,
    localeCanonical,
    localeOpenGraph,
    localePageRobots,
} from '@/shared/lib/seoAlternates';
import { SITE_NAME } from '@/shared/lib/seo';
import { OG_IMAGE_HEIGHT, OG_IMAGE_WIDTH } from '@/shared/lib/og';
import type { Locale } from '@/shared/i18n/locales';

/**
 * 헬퍼 도입 전 허브 라우트(economy·market·fear-greed)가 손으로 만들던 모양 그대로.
 * 이 기대값과 **완전히 같아야** 메타데이터·OG 출력이 바뀌지 않는다.
 */
async function legacyHubMetadata(
    locale: Locale,
    path: string,
    title: string,
    description: string,
    keywords: string[],
    degraded: boolean
): Promise<Metadata> {
    const fullTitle = `${title} | ${SITE_NAME}`;
    return {
        title,
        description,
        keywords,
        alternates: await localeAlternatesFrom(
            Promise.resolve({ locale }),
            path,
            { canonical: degraded ? null : undefined }
        ),
        robots: degraded
            ? { index: false, follow: true }
            : localePageRobots(locale),
        openGraph: {
            title: fullTitle,
            description,
            url: localeCanonical(locale, path),
            siteName: SITE_NAME,
            ...localeOpenGraph(locale),
            type: 'website',
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
            card: 'summary_large_image',
            title: fullTitle,
            description,
            images: ['/og-image.png'],
        },
    };
}

describe('buildHubMetadata', () => {
    const cases: ReadonlyArray<[Locale, boolean]> = [
        ['ko', false],
        ['ko', true],
        ['en', false],
        ['en', true],
        ['ja', false],
        ['zh', true],
    ];

    it.each(cases)(
        '%s / degraded=%s: 헬퍼 도입 전 손으로 만든 메타데이터와 같다',
        async (locale, degraded) => {
            const keywords = ['시장 신호', 'market'];
            const actual = await buildHubMetadata({
                params: Promise.resolve({ locale }),
                locale,
                path: '/market/kr',
                title: '한국 시장 신호',
                description: '설명',
                keywords,
                degraded,
            });
            expect(actual).toEqual(
                await legacyHubMetadata(
                    locale,
                    '/market/kr',
                    '한국 시장 신호',
                    '설명',
                    keywords,
                    degraded
                )
            );
        }
    );

    it('degraded면 canonical을 비우고 noindex·follow', async () => {
        const actual = await buildHubMetadata({
            params: Promise.resolve({ locale: 'ko' }),
            locale: 'ko',
            path: '/economy',
            title: 't',
            description: 'd',
            keywords: [],
            degraded: true,
        });
        expect(actual.alternates?.canonical).toBeNull();
        expect(actual.robots).toEqual({ index: false, follow: true });
    });
});
