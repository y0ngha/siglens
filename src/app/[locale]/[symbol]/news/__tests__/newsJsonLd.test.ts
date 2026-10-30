import { describe, expect, it } from 'vitest';

import type { SymbolNewsListItems } from '@/app/[locale]/[symbol]/_lib/symbolNewsList';
import {
    buildNewsArticleJsonLd,
    buildNewsListJsonLd,
    newsArticleDates,
} from '@/app/[locale]/[symbol]/news/_lib/newsJsonLd';
import { NEWS_LIST_PAGE_SIZE } from '@/shared/config/newsSerialization';
import { ORGANIZATION_JSON_LD_ID, SITE_URL } from '@/shared/lib/seo';

/** 목록 행은 JSON-LD가 읽는 필드(url·제목)만 채운다 — 나머지 컬럼은 이 빌더와 무관하다. */
function newsRows(count: number): SymbolNewsListItems {
    return Array.from({ length: count }, (_, i) => ({
        url: `https://news.example.com/${i}`,
        titleKo: `한국어 제목 ${i}`,
        titleEn: `English title ${i}`,
    })) as unknown as SymbolNewsListItems;
}

describe('newsArticleDates', () => {
    it('생성 시각을 dateModified로, 최초 생성 시각을 datePublished로 낸다', () => {
        expect(
            newsArticleDates(
                new Date('2026-10-20T03:00:00.000Z'),
                new Date('2026-08-01T00:00:00.000Z')
            )
        ).toEqual({
            datePublished: '2026-08-01T00:00:00.000Z',
            dateModified: '2026-10-20T03:00:00.000Z',
        });
    });

    it('캐시 왕복으로 문자열이 된 시각도 ISO로 정규화한다', () => {
        expect(
            newsArticleDates(
                '2026-10-20T03:00:00.000Z',
                '2026-08-01T00:00:00.000Z'
            )
        ).toEqual({
            datePublished: '2026-08-01T00:00:00.000Z',
            dateModified: '2026-10-20T03:00:00.000Z',
        });
    });

    it('발행이 수정보다 늦으면 발행일을 생략한다', () => {
        expect(
            newsArticleDates(
                new Date('2026-08-01T00:00:00.000Z'),
                new Date('2026-10-20T03:00:00.000Z')
            )
        ).toEqual({
            datePublished: null,
            dateModified: '2026-08-01T00:00:00.000Z',
        });
    });

    it('최초 생성 시각이 없으면 발행일을 지어내지 않는다', () => {
        expect(
            newsArticleDates(new Date('2026-10-20T03:00:00.000Z'), null)
        ).toEqual({
            datePublished: null,
            dateModified: '2026-10-20T03:00:00.000Z',
        });
    });

    it('스냅샷이 없으면 발행일만 남는다(수정 시각 비교 대상이 없다)', () => {
        expect(
            newsArticleDates(undefined, new Date('2026-08-01T00:00:00.000Z'))
        ).toEqual({
            datePublished: '2026-08-01T00:00:00.000Z',
            dateModified: null,
        });
    });
});

describe('buildNewsArticleJsonLd', () => {
    const base = {
        headline: '애플 뉴스 요약',
        description: '애플 뉴스 설명',
        pageUrl: `${SITE_URL}/AAPL/news`,
    };

    it('날짜가 없으면 datePublished·dateModified 필드를 싣지 않는다', () => {
        const node = buildNewsArticleJsonLd({
            ...base,
            locale: 'ko',
            dates: { datePublished: null, dateModified: null },
        });
        expect(node).not.toHaveProperty('datePublished');
        expect(node).not.toHaveProperty('dateModified');
    });

    it('날짜가 있으면 그대로 싣는다', () => {
        const node = buildNewsArticleJsonLd({
            ...base,
            locale: 'ko',
            dates: {
                datePublished: '2026-08-01T00:00:00.000Z',
                dateModified: '2026-10-20T03:00:00.000Z',
            },
        });
        expect(node).toMatchObject({
            datePublished: '2026-08-01T00:00:00.000Z',
            dateModified: '2026-10-20T03:00:00.000Z',
        });
    });

    it('isPartOf는 로케일 접두사가 붙은 같은 문서의 WebPage를 가리킨다', () => {
        const node = buildNewsArticleJsonLd({
            ...base,
            locale: 'en',
            dates: { datePublished: null, dateModified: null },
        });
        expect(node.isPartOf).toEqual({
            '@type': 'WebPage',
            '@id': `${SITE_URL}/en/AAPL/news#webpage`,
        });
        expect(node.inLanguage).toBe('en');
    });

    it('author는 /about을, publisher는 홈을 가리키고 둘 다 사이트 발행 주체 @id를 쓴다', () => {
        const node = buildNewsArticleJsonLd({
            ...base,
            locale: 'ko',
            dates: { datePublished: null, dateModified: null },
        });
        expect(node.author).toMatchObject({
            '@id': ORGANIZATION_JSON_LD_ID,
            url: `${SITE_URL}/about`,
        });
        expect(node.publisher).toMatchObject({
            '@id': ORGANIZATION_JSON_LD_ID,
            url: SITE_URL,
        });
        expect(node.image).toEqual([`${SITE_URL}/og-image.png`]);
    });
});

describe('buildNewsListJsonLd', () => {
    it('목록이 비면 노드를 만들지 않는다', () => {
        expect(buildNewsListJsonLd(newsRows(0), '애플 뉴스', 'ko')).toBeNull();
    });

    it('초기 DOM에 그려지는 카드 수까지만 싣는다', () => {
        const node = buildNewsListJsonLd(
            newsRows(NEWS_LIST_PAGE_SIZE + 3),
            '애플 뉴스',
            'ko'
        );
        expect(node?.itemListElement).toHaveLength(NEWS_LIST_PAGE_SIZE);
    });

    it('항목은 위치·URL·로케일 제목만 말한다', () => {
        const node = buildNewsListJsonLd(newsRows(2), 'Apple news', 'en');
        expect(node).toEqual({
            '@context': 'https://schema.org',
            '@type': 'ItemList',
            name: 'Apple news',
            itemListElement: [
                {
                    '@type': 'ListItem',
                    position: 1,
                    url: 'https://news.example.com/0',
                    name: 'English title 0',
                },
                {
                    '@type': 'ListItem',
                    position: 2,
                    url: 'https://news.example.com/1',
                    name: 'English title 1',
                },
            ],
        });
    });
});
