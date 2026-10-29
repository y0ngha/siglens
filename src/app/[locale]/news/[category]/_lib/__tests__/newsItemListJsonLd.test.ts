import { describe, expect, it } from 'vitest';
import { buildNewsItemListJsonLd } from '@/app/[locale]/news/[category]/_lib/newsItemListJsonLd';
import type { MarketNewsCardItem } from '@/entities/market-news/lib/toCardItem';
import { MARKET_NEWS_LIST_PAGE_SIZE } from '@/shared/config/newsSerialization';

function item(index: number): MarketNewsCardItem {
    return {
        id: `n${index}`,
        source: 'Reuters',
        url: `https://example.com/a${index}?utm_source=feed&id=${index}`,
        publishedAt: '2026-06-22T10:00:00.000Z',
        titleEn: `Headline ${index}`,
        titleKo: `헤드라인 ${index}`,
        bodyKo: null,
        summaryKo: null,
        sentiment: null,
        category: null,
        priceImpact: null,
        tickers: [],
    } as MarketNewsCardItem;
}

describe('buildNewsItemListJsonLd', () => {
    it('기사가 없으면 null이다', () => {
        expect(buildNewsItemListJsonLd([], '목록', 'ko')).toBeNull();
    });

    it('초기 DOM 카드 수만큼만 싣는다', () => {
        const items = Array.from(
            { length: MARKET_NEWS_LIST_PAGE_SIZE + 3 },
            (_, i) => item(i)
        );

        const jsonLd = buildNewsItemListJsonLd(items, '목록', 'ko');

        expect(jsonLd?.itemListElement).toHaveLength(
            MARKET_NEWS_LIST_PAGE_SIZE
        );
    });

    it('항목은 위치·utm을 뗀 URL·로케일 제목만 말한다', () => {
        const jsonLd = buildNewsItemListJsonLd(
            [item(1)],
            '미국 주식 뉴스',
            'ko'
        );

        expect(jsonLd).toEqual({
            '@context': 'https://schema.org',
            '@type': 'ItemList',
            name: '미국 주식 뉴스',
            itemListElement: [
                {
                    '@type': 'ListItem',
                    position: 1,
                    url: 'https://example.com/a1?id=1',
                    name: '헤드라인 1',
                },
            ],
        });
    });
});
