vi.mock('@/shared/lib/seo', () => ({
    SITE_BUILD_DATE: new Date('2025-01-01T00:00:00.000Z'),
    SITE_NAME: 'Siglens',
    SITE_URL: 'https://siglens.io',
}));

import { buildStaticEntries } from '../lib/buildStaticEntries';
import { SITE_URL } from '@/shared/lib/seo';
import { MS_PER_HOUR } from '@/shared/config/time';
import { lastClosedSessionCloseUtc } from '@/shared/lib/marketSessionDate';

const NOW = new Date('2026-05-23T15:30:00.000Z');

describe('buildStaticEntries', () => {
    it('home / market / fear-greed / backtesting / economy / news hub + 5 categories / privacy / terms 13개 엔트리를 반환한다', () => {
        const entries = buildStaticEntries(NOW);
        expect(entries).toHaveLength(13);

        const urls = entries.map(e => e.url);
        expect(urls).toEqual(
            expect.arrayContaining([
                expect.stringMatching(/\/$|siglens\.io$/), // home
                expect.stringContaining('/market'),
                expect.stringContaining('/fear-greed'),
                expect.stringContaining('/backtesting'),
                expect.stringContaining('/economy'),
                expect.stringContaining('/news'),
                expect.stringContaining('/privacy'),
                expect.stringContaining('/terms'),
            ])
        );
    });

    it('/fear-greed는 daily·priority 0.8, 직전 마감 세션을 lastmod로 사용한다', () => {
        const entries = buildStaticEntries(NOW);
        const fearGreed = entries.find(e => e.url.endsWith('/fear-greed'));
        expect(fearGreed).toBeDefined();
        expect(fearGreed!.changeFrequency).toBe('daily');
        expect(fearGreed!.priority).toBe(0.8);
        expect(fearGreed!.lastModified.getTime()).toBe(
            lastClosedSessionCloseUtc(NOW).getTime()
        );
        // 요청 시각을 그대로 쓰면 크롤러가 가져갈 때마다 freshness가 갱신된다.
        expect(fearGreed!.lastModified.getTime()).toBeLessThan(NOW.getTime());
    });

    it('/fear-greed lastmod는 같은 세션 안에서 호출 시각이 달라도 동일하다', () => {
        // NOW(2026-05-23 15:30Z)는 토요일 — 같은 날 다른 시각에 두 번 만들어도
        // 직전 금요일 마감으로 고정돼야 한다.
        const a = buildStaticEntries(new Date('2026-05-23T00:10:00.000Z'));
        const b = buildStaticEntries(new Date('2026-05-23T23:50:00.000Z'));
        const pick = (es: ReturnType<typeof buildStaticEntries>) =>
            es.find(e => e.url.endsWith('/fear-greed'))!.lastModified.getTime();
        expect(pick(a)).toBe(pick(b));
    });

    it('/economy는 daily·priority 0.8로 둔다', () => {
        const entries = buildStaticEntries(NOW);
        const economy = entries.find(e => e.url.endsWith('/economy'));
        expect(economy).toBeDefined();
        expect(economy!.changeFrequency).toBe('daily');
        expect(economy!.priority).toBe(0.8);
    });

    it('/news hub + 5 카테고리 entries가 포함된다', () => {
        const entries = buildStaticEntries(NOW);
        const urls = entries.map(e => e.url);
        expect(urls).toContain(`${SITE_URL}/news`);
        for (const slug of [
            'general',
            'stock',
            'crypto',
            'forex',
            'articles',
        ]) {
            expect(urls).toContain(`${SITE_URL}/news/${slug}`);
        }
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

    it('/news hub과 5개 카테고리 entries는 UTC 일 경계를 lastModified로 사용한다', () => {
        const startOfDay = new Date('2026-05-23T00:00:00.000Z');
        const entries = buildStaticEntries(NOW);
        const newsHub = entries.find(e => e.url === `${SITE_URL}/news`);
        expect(newsHub).toBeDefined();
        expect(newsHub!.lastModified.getTime()).toBe(startOfDay.getTime());

        for (const slug of [
            'general',
            'stock',
            'crypto',
            'forex',
            'articles',
        ]) {
            const cat = entries.find(e => e.url === `${SITE_URL}/news/${slug}`);
            expect(cat).toBeDefined();
            expect(cat!.lastModified.getTime()).toBe(startOfDay.getTime());
        }
    });

    /**
     * 회귀 가드: sitemap 라우트가 `force-dynamic`이라 lastmod에 요청 시각을 쓰면
     * 크롤러가 가져갈 때마다 값이 바뀐다. `/market`(장중 스캐너, ISR 1h)만 슬라이딩을
     *허용하고 나머지는 전부 요청 시각보다 과거의 고정 시점이어야 한다.
     */
    it('/market 외에는 어떤 엔트리도 요청 시각을 그대로 lastmod로 쓰지 않는다', () => {
        const entries = buildStaticEntries(NOW);
        const usingNow = entries.filter(
            e => e.lastModified.getTime() === NOW.getTime()
        );
        expect(usingNow).toEqual([]);

        const market = entries.find(e => e.url === `${SITE_URL}/market`);
        expect(market!.lastModified.getTime()).toBe(
            NOW.getTime() - MS_PER_HOUR
        );
    });
});
