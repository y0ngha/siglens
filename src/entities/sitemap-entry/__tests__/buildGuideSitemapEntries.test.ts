import type { GuideEntrySummary } from '@/entities/guide/types';
import { SITE_URL } from '@/shared/lib/seo';
import { buildGuideSitemapEntries } from '../lib/buildGuideSitemapEntries';

const NOW = new Date('2026-10-10T00:00:00.000Z');

function summary(
    overrides: Partial<GuideEntrySummary> = {}
): GuideEntrySummary {
    return {
        slug: 'rsi',
        category: 'indicators',
        order: 1,
        title: 'RSI',
        aliases: [],
        summary: '요약',
        updatedAt: '2026-10-01T00:00:00.000Z',
        ...overrides,
    };
}

describe('buildGuideSitemapEntries', () => {
    it('카탈로그가 비면 아무것도 싣지 않는다', () => {
        expect(buildGuideSitemapEntries([], NOW)).toEqual([]);
    });

    it('허브, 항목이 있는 카테고리, 항목을 순서대로 싣는다', () => {
        const urls = buildGuideSitemapEntries(
            [
                summary(),
                summary({
                    slug: 'doji',
                    category: 'candlesticks',
                    updatedAt: '2026-10-05T00:00:00.000Z',
                }),
            ],
            NOW
        ).map(entry => entry.url);

        expect(urls).toEqual([
            `${SITE_URL}/guide`,
            `${SITE_URL}/guide/candlesticks`,
            `${SITE_URL}/guide/indicators`,
            `${SITE_URL}/guide/indicators/rsi`,
            `${SITE_URL}/guide/candlesticks/doji`,
        ]);
    });

    it('카테고리와 허브 lastmod는 아래 항목의 최댓값이다', () => {
        const byUrl = new Map(
            buildGuideSitemapEntries(
                [
                    summary(),
                    summary({
                        slug: 'macd',
                        updatedAt: '2026-10-03T00:00:00.000Z',
                    }),
                    summary({
                        slug: 'doji',
                        category: 'candlesticks',
                        updatedAt: '2026-10-05T00:00:00.000Z',
                    }),
                ],
                NOW
            ).map(entry => [entry.url, entry.lastModified?.toISOString()])
        );

        expect(byUrl.get(`${SITE_URL}/guide/indicators`)).toBe(
            '2026-10-03T00:00:00.000Z'
        );
        expect(byUrl.get(`${SITE_URL}/guide`)).toBe('2026-10-05T00:00:00.000Z');
    });

    it('updatedAt이 파싱되지 않으면 now로 대신한다', () => {
        const [hub] = buildGuideSitemapEntries(
            [summary({ updatedAt: 'not-a-date' })],
            NOW
        );

        expect(hub?.lastModified).toEqual(NOW);
    });
});
