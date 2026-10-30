import { SITE_URL } from '@/shared/lib/seo';

import { buildNewsSitemapEntries } from '../lib/buildNewsSitemapEntries';

const NOW = new Date('2026-05-23T15:30:00.000Z');
const FALLBACK = new Date('2026-05-23T00:00:00.000Z');
const HOUR = 3_600_000;

const urlsOf = (result: ReturnType<typeof buildNewsSitemapEntries>): string[] =>
    result.categoryEntries.map(entry => entry.url);

describe('buildNewsSitemapEntries', () => {
    it('로더 실패(undefined)면 모든 카테고리를 fallback lastmod로 싣는다', () => {
        const result = buildNewsSitemapEntries(NOW, undefined, FALLBACK);

        expect(urlsOf(result)).toContain(`${SITE_URL}/news/general`);
        expect(urlsOf(result)).toContain(`${SITE_URL}/news/crypto`);
        expect(
            result.categoryEntries.every(
                entry => entry.lastModified === FALLBACK
            )
        ).toBe(true);
        expect(result.hubLastModified).toBe(FALLBACK);
        expect(result.usLastModified).toBe(FALLBACK);
    });

    it('로더 성공·기사 0건({})이면 카테고리를 하나도 싣지 않고 허브는 fallback이다', () => {
        const result = buildNewsSitemapEntries(NOW, {}, FALLBACK);

        expect(result.categoryEntries).toEqual([]);
        expect(result.hubLastModified).toBe(FALLBACK);
    });

    it('최신 기사가 있는 카테고리만 그 시각으로 싣고 daily·0.8이다', () => {
        const stockAt = new Date(NOW.getTime() - HOUR);
        const result = buildNewsSitemapEntries(
            NOW,
            { stock: stockAt },
            FALLBACK
        );

        expect(result.categoryEntries).toEqual([
            expect.objectContaining({
                url: `${SITE_URL}/news/stock`,
                lastModified: stockAt,
                changeFrequency: 'daily',
                priority: 0.8,
            }),
        ]);
    });

    it('창(7일 − 12시간) 밖으로 정체된 카테고리는 뺀다', () => {
        const stale = new Date(NOW.getTime() - 7 * 24 * HOUR);
        const fresh = new Date(NOW.getTime() - 2 * HOUR);
        const result = buildNewsSitemapEntries(
            NOW,
            { forex: stale, crypto: fresh },
            FALLBACK
        );

        expect(urlsOf(result)).toEqual([`${SITE_URL}/news/crypto`]);
    });

    it('허브 lastmod는 싣는 카테고리들의 최신값이고, 빠진 카테고리는 영향이 없다', () => {
        const older = new Date(NOW.getTime() - 5 * HOUR);
        const newer = new Date(NOW.getTime() - 1 * HOUR);
        const stale = new Date(NOW.getTime() - 30 * 24 * HOUR);
        const result = buildNewsSitemapEntries(
            NOW,
            { stock: older, crypto: newer, forex: stale },
            FALLBACK
        );

        expect(result.hubLastModified).toBe(newer);
    });

    it('미국 허브는 미국 지역 카테고리만 본다', () => {
        const stockAt = new Date(NOW.getTime() - 5 * HOUR);
        const cryptoAt = new Date(NOW.getTime() - 1 * HOUR);
        const result = buildNewsSitemapEntries(
            NOW,
            { stock: stockAt, crypto: cryptoAt },
            FALLBACK
        );

        expect(result.usLastModified).toBe(stockAt);
        expect(result.hubLastModified).toBe(cryptoAt);
    });
});
