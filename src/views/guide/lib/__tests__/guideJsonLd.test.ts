import { describe, expect, it } from 'vitest';
import { guideEntry } from '@/__tests__/fixtures/guideFixtures';
import {
    ABOUT_PATH,
    OPERATOR_PERSON_JSON_LD_ID,
    SITE_OPERATOR,
} from '@/shared/lib/legal';
import { ORGANIZATION_JSON_LD_ID, SITE_URL } from '@/shared/lib/seo';
import {
    buildGuideArticleJsonLd,
    buildGuideBreadcrumbJsonLd,
    buildGuideCollectionJsonLd,
    buildGuideFaqJsonLd,
} from '../guideJsonLd';

const RSI = guideEntry({
    slug: 'rsi',
    title: 'RSI 제목',
    seoDescription: 'RSI SEO 설명',
    updatedAt: '2026-10-09T15:00:00.000Z',
});

describe('buildGuideArticleJsonLd', () => {
    it('ko는 접두사 없는 URL과 본문 언어 ko, dateModified를 낸다', () => {
        const ld = buildGuideArticleJsonLd({ locale: 'ko', entry: RSI });

        expect(ld).toMatchObject({
            '@type': 'TechArticle',
            '@id': `${SITE_URL}/guide/indicators/rsi#article`,
            url: `${SITE_URL}/guide/indicators/rsi`,
            mainEntityOfPage: {
                '@type': 'WebPage',
                '@id': `${SITE_URL}/guide/indicators/rsi`,
            },
            headline: 'RSI 제목',
            description: 'RSI SEO 설명',
            inLanguage: 'ko',
            dateModified: '2026-10-09T15:00:00.000Z',
            image: `${SITE_URL}/og-image.png`,
            author: {
                '@type': 'Person',
                '@id': OPERATOR_PERSON_JSON_LD_ID,
                name: SITE_OPERATOR.name,
                url: `${SITE_URL}${ABOUT_PATH}`,
            },
            publisher: { '@id': ORGANIZATION_JSON_LD_ID },
        });
        expect(ld).not.toHaveProperty('datePublished');
    });

    it.each([
        ['en', 'en', '/en'],
        ['ja', 'ja', '/ja'],
        ['zh', 'zh-Hans', '/zh'],
    ] as const)(
        '%s는 접두사 URL과 inLanguage %s를 쓴다',
        (locale, inLanguage, prefix) => {
            const ld = buildGuideArticleJsonLd({ locale, entry: RSI });

            expect(ld.url).toBe(`${SITE_URL}${prefix}/guide/indicators/rsi`);
            expect(ld['@id']).toBe(
                `${SITE_URL}${prefix}/guide/indicators/rsi#article`
            );
            expect(ld.inLanguage).toBe(inLanguage);
        }
    );

    it('번역이 없어 ko로 대신한 렌더는 URL은 로케일을 따르되 inLanguage는 ko다', () => {
        const ld = buildGuideArticleJsonLd({
            locale: 'en',
            entry: guideEntry({ slug: 'rsi', isFallback: true }),
        });

        expect(ld.url).toBe(`${SITE_URL}/en/guide/indicators/rsi`);
        expect(ld.inLanguage).toBe('ko');
    });
});

describe('buildGuideBreadcrumbJsonLd', () => {
    function trail(ld: Record<string, unknown>) {
        return (
            ld.itemListElement as {
                position: number;
                name: string;
                item: string;
            }[]
        ).map(({ position, name, item }) => ({ position, name, item }));
    }

    it('허브만이면 홈 › 허브 두 칸이다', () => {
        const ld = buildGuideBreadcrumbJsonLd({
            locale: 'ko',
            hubTitle: '차트 가이드',
        });

        expect(trail(ld)).toEqual([
            { position: 1, name: 'SIGLENS', item: SITE_URL },
            { position: 2, name: '차트 가이드', item: `${SITE_URL}/guide` },
        ]);
    });

    it('분류가 있으면 허브 뒤에 분류가 붙는다', () => {
        const ld = buildGuideBreadcrumbJsonLd({
            locale: 'ko',
            hubTitle: '차트 가이드',
            category: { id: 'indicators', label: '보조지표' },
        });

        expect(trail(ld).slice(2)).toEqual([
            {
                position: 3,
                name: '보조지표',
                item: `${SITE_URL}/guide/indicators`,
            },
        ]);
    });

    it('분류와 항목이 모두 있으면 항목이 마지막 칸이다', () => {
        const ld = buildGuideBreadcrumbJsonLd({
            locale: 'ko',
            hubTitle: '차트 가이드',
            category: { id: 'indicators', label: '보조지표' },
            entryTitle: 'RSI',
            entrySlug: 'rsi',
        });

        expect(trail(ld)).toHaveLength(4);
        expect(trail(ld)[3]).toEqual({
            position: 4,
            name: 'RSI',
            item: `${SITE_URL}/guide/indicators/rsi`,
        });
    });

    it('항목 제목만 있고 slug가 없으면 항목 칸을 내지 않는다', () => {
        const ld = buildGuideBreadcrumbJsonLd({
            locale: 'ko',
            hubTitle: '차트 가이드',
            category: { id: 'indicators', label: '보조지표' },
            entryTitle: 'RSI',
        });

        expect(trail(ld)).toHaveLength(3);
    });

    it('분류 없이 항목만 넘기면 항목 칸을 내지 않는다', () => {
        const ld = buildGuideBreadcrumbJsonLd({
            locale: 'ko',
            hubTitle: '차트 가이드',
            entryTitle: 'RSI',
            entrySlug: 'rsi',
        });

        expect(trail(ld)).toHaveLength(2);
    });

    it('en은 모든 칸의 URL에 /en 접두사를 붙인다', () => {
        const ld = buildGuideBreadcrumbJsonLd({
            locale: 'en',
            hubTitle: 'Chart Guide',
            category: { id: 'candlesticks', label: 'Candlesticks' },
            entryTitle: 'Doji',
            entrySlug: 'doji',
        });

        expect(trail(ld).map(item => item.item)).toEqual([
            `${SITE_URL}/en`,
            `${SITE_URL}/en/guide`,
            `${SITE_URL}/en/guide/candlesticks`,
            `${SITE_URL}/en/guide/candlesticks/doji`,
        ]);
    });
});

describe('buildGuideFaqJsonLd', () => {
    it('비어 있으면 null이다', () => {
        expect(buildGuideFaqJsonLd([])).toBeNull();
    });

    it('q/a를 Question/acceptedAnswer로 순서대로 옮긴다', () => {
        const ld = buildGuideFaqJsonLd([
            { q: '첫 질문?', a: '첫 답.' },
            { q: '둘째 질문?', a: '둘째 답.' },
        ]);

        expect(ld).toMatchObject({ '@type': 'FAQPage' });
        expect(ld?.mainEntity).toEqual([
            {
                '@type': 'Question',
                name: '첫 질문?',
                acceptedAnswer: { '@type': 'Answer', text: '첫 답.' },
            },
            {
                '@type': 'Question',
                name: '둘째 질문?',
                acceptedAnswer: { '@type': 'Answer', text: '둘째 답.' },
            },
        ]);
    });
});

describe('buildGuideCollectionJsonLd', () => {
    const ENTRIES = [
        guideEntry({ slug: 'doji', category: 'candlesticks', title: '도지' }),
        guideEntry({ slug: 'rsi', title: 'RSI' }),
        guideEntry({ slug: 'macd', title: 'MACD' }),
    ];

    it('ko: 접두사 없는 URL, 입력 순서대로 1부터 매긴 ItemList', () => {
        const ld = buildGuideCollectionJsonLd({
            locale: 'ko',
            path: '/guide',
            name: '차트 가이드',
            description: '설명',
            entries: ENTRIES,
        });

        expect(ld).toMatchObject({
            '@type': 'CollectionPage',
            '@id': `${SITE_URL}/guide#webpage`,
            url: `${SITE_URL}/guide`,
            name: '차트 가이드',
            description: '설명',
            inLanguage: 'ko',
            publisher: { '@id': ORGANIZATION_JSON_LD_ID },
        });
        expect(ld.mainEntity).toEqual({
            '@type': 'ItemList',
            numberOfItems: 3,
            itemListElement: [
                {
                    '@type': 'ListItem',
                    position: 1,
                    name: '도지',
                    url: `${SITE_URL}/guide/candlesticks/doji`,
                },
                {
                    '@type': 'ListItem',
                    position: 2,
                    name: 'RSI',
                    url: `${SITE_URL}/guide/indicators/rsi`,
                },
                {
                    '@type': 'ListItem',
                    position: 3,
                    name: 'MACD',
                    url: `${SITE_URL}/guide/indicators/macd`,
                },
            ],
        });
    });

    it('zh: 페이지와 항목 URL이 모두 /zh 접두사이고 inLanguage는 zh-Hans다', () => {
        const ld = buildGuideCollectionJsonLd({
            locale: 'zh',
            path: '/guide/indicators',
            name: '指标',
            description: '说明',
            entries: ENTRIES.slice(1),
        });

        expect(ld.url).toBe(`${SITE_URL}/zh/guide/indicators`);
        expect(ld['@id']).toBe(`${SITE_URL}/zh/guide/indicators#webpage`);
        expect(ld.inLanguage).toBe('zh-Hans');
        const list = ld.mainEntity as {
            itemListElement: { url: string }[];
        };
        expect(list.itemListElement.map(item => item.url)).toEqual([
            `${SITE_URL}/zh/guide/indicators/rsi`,
            `${SITE_URL}/zh/guide/indicators/macd`,
        ]);
    });

    it('항목이 없으면 numberOfItems 0, 빈 목록이다', () => {
        const ld = buildGuideCollectionJsonLd({
            locale: 'ko',
            path: '/guide',
            name: 'n',
            description: 'd',
            entries: [],
        });

        expect(ld.mainEntity).toEqual({
            '@type': 'ItemList',
            numberOfItems: 0,
            itemListElement: [],
        });
    });
});
