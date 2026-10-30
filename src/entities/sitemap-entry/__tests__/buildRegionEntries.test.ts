import {
    ALL_NAV_REGION_LINKS,
    type NavRegionId,
} from '@/shared/config/assetClassNav';
import { SITE_URL } from '@/shared/lib/seo';

import { buildRegionEntries } from '../lib/buildRegionEntries';

const BASIS = {
    todayUtc: new Date('2026-05-23T00:00:00.000Z'),
    lastUsSessionClose: new Date('2026-05-22T20:00:00.000Z'),
    lastKrSessionClose: new Date('2026-05-22T06:30:00.000Z'),
};

describe('buildRegionEntries', () => {
    const entries = buildRegionEntries(BASIS);
    const entryOf = (href: string): (typeof entries)[number] | undefined =>
        entries.find(entry => entry.url === `${SITE_URL}${href}`);

    it('뉴스 지역 링크는 싣지 않는다 — 카테고리 엔트리와 URL이 겹친다', () => {
        const isNews = (href: string): boolean => href.startsWith('/news/');
        const newsLinks = ALL_NAV_REGION_LINKS.filter(link =>
            isNews(link.href)
        );
        const otherLinks = ALL_NAV_REGION_LINKS.filter(
            link => !isNews(link.href)
        );

        expect(newsLinks.length).toBeGreaterThan(0);
        for (const link of newsLinks) {
            expect(entryOf(link.href), link.href).toBeUndefined();
        }
        for (const link of otherLinks) {
            expect(entryOf(link.href), link.href).toBeDefined();
        }
    });

    it('시장 허브는 hourly·0.9다', () => {
        expect(entryOf('/market')).toMatchObject({
            changeFrequency: 'hourly',
            priority: 0.9,
        });
    });

    it('시장 외 지역 페이지는 daily·0.8이다', () => {
        expect(entryOf('/fear-greed')).toMatchObject({
            changeFrequency: 'daily',
            priority: 0.8,
        });
    });

    it('미국 시장·공포탐욕은 직전 미국 세션 마감을 광고한다', () => {
        expect(entryOf('/market')?.lastModified).toBe(BASIS.lastUsSessionClose);
        expect(entryOf('/fear-greed')?.lastModified).toBe(
            BASIS.lastUsSessionClose
        );
    });

    it('경제 페이지는 UTC 일 경계를 광고한다', () => {
        expect(entryOf('/economy')?.lastModified).toBe(BASIS.todayUtc);
    });

    it('국내 지역의 시장·공포탐욕은 직전 KRX 세션 마감을, 크립토는 UTC 일 경계를 광고한다', () => {
        const regional = ALL_NAV_REGION_LINKS.filter(
            link =>
                link.href.startsWith('/market') ||
                link.href.startsWith('/fear-greed')
        );
        const expectedByRegion: Record<NavRegionId, Date> = {
            kr: BASIS.lastKrSessionClose,
            crypto: BASIS.todayUtc,
            us: BASIS.lastUsSessionClose,
        };

        for (const link of regional) {
            expect(entryOf(link.href)?.lastModified).toBe(
                expectedByRegion[link.region]
            );
        }
        expect(regional.some(link => link.region === 'kr')).toBe(true);
        expect(regional.some(link => link.region === 'crypto')).toBe(true);
    });
});
