vi.mock('@/shared/lib/seo', () => ({
    SITE_BUILD_DATE: new Date('2025-01-01T00:00:00.000Z'),
    SITE_NAME: 'Siglens',
    SITE_URL: 'https://siglens.io',
}));

import { buildStaticEntries } from '../lib/buildStaticEntries';
import { MS_PER_HOUR } from '@/shared/config/time';

const NOW = new Date('2026-05-23T15:30:00.000Z');

describe('buildStaticEntries', () => {
    it('home / market / backtesting / economy / privacy / terms 6개 엔트리를 반환한다', () => {
        const entries = buildStaticEntries(NOW);
        expect(entries).toHaveLength(6);

        const urls = entries.map(e => e.url);
        expect(urls).toEqual(
            expect.arrayContaining([
                expect.stringMatching(/\/$|siglens\.io$/), // home
                expect.stringContaining('/market'),
                expect.stringContaining('/backtesting'),
                expect.stringContaining('/economy'),
                expect.stringContaining('/privacy'),
                expect.stringContaining('/terms'),
            ])
        );
    });

    it('/economy는 daily·priority 0.8로 둔다', () => {
        const entries = buildStaticEntries(NOW);
        const economy = entries.find(e => e.url.endsWith('/economy'));
        expect(economy).toBeDefined();
        expect(economy!.changeFrequency).toBe('daily');
        expect(economy!.priority).toBe(0.8);
    });

    it('/market은 1시간 슬라이딩 lastmod를 적용한다', () => {
        const entries = buildStaticEntries(NOW);
        const market = entries.find(e => e.url.endsWith('/market'));
        expect(market).toBeDefined();
        expect(market!.lastModified.getTime()).toBe(
            NOW.getTime() - MS_PER_HOUR
        );
        expect(market!.changeFrequency).toBe('hourly');
    });

    it('home은 priority 1.0, monthly로 둔다', () => {
        const entries = buildStaticEntries(NOW);
        const home = entries[0];
        expect(home.priority).toBe(1);
        expect(home.changeFrequency).toBe('monthly');
    });

    it('legal 페이지는 yearly, priority 0.3', () => {
        const entries = buildStaticEntries(NOW);
        const legal = entries.filter(
            e => e.url.includes('/privacy') || e.url.includes('/terms')
        );
        expect(legal).toHaveLength(2);
        for (const entry of legal) {
            expect(entry.changeFrequency).toBe('yearly');
            expect(entry.priority).toBe(0.3);
        }
    });
});
