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
 *
 * 단 degraded의 canonical만은 의도적으로 바꿨다 — `null`이 아니라 self-canonical(hreflang 없음).
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
        alternates: degraded
            ? { canonical: localeCanonical(locale, path) }
            : await localeAlternatesFrom(Promise.resolve({ locale }), path),
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
            site: '@siglens_io',
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

    it('degraded면 noindex·follow + self-canonical만 — hreflang·발견 링크는 싣지 않는다', async () => {
        const actual = await buildHubMetadata({
            params: Promise.resolve({ locale: 'ko' }),
            locale: 'ko',
            path: '/economy',
            title: 't',
            description: 'd',
            keywords: [],
            degraded: true,
            alternateTypes: {
                'application/rss+xml': 'https://siglens.io/rss.xml',
            },
        });
        expect(actual.alternates).toEqual({
            canonical: 'https://siglens.io/economy',
        });
        expect(actual.robots).toEqual({ index: false, follow: true });
    });

    it('alternateTypes를 넘기면 발견 링크로 싣고, 안 넘기면 키 자체가 없다', async () => {
        const base = {
            params: Promise.resolve({ locale: 'ko' }),
            locale: 'ko',
            path: '/market',
            title: 't',
            description: 'd',
            keywords: [],
            degraded: false,
        } as const;
        const withTypes = await buildHubMetadata({
            ...base,
            alternateTypes: {
                'application/rss+xml': 'https://siglens.io/rss.xml',
            },
        });
        const without = await buildHubMetadata(base);

        expect(withTypes.alternates?.types).toEqual({
            'application/rss+xml': 'https://siglens.io/rss.xml',
        });
        expect(without.alternates).not.toHaveProperty('types');
    });
});
