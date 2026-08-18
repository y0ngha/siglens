vi.mock('@/shared/lib/seo', () => ({
    SITE_BUILD_DATE: new Date('2025-01-01T00:00:00.000Z'),
    SITE_NAME: 'Siglens',
    SITE_URL: 'https://siglens.io',
}));

import { buildStaticEntries } from '../lib/buildStaticEntries';
import { SITE_URL } from '@/shared/lib/seo';
import { MS_PER_HOUR } from '@/shared/config/time';
import { US_EQUITY_SESSION } from '@y0ngha/siglens-core';
import { lastClosedSessionCloseUtc } from '@/shared/lib/marketSessionDate';
import { floorToHour } from '../lib/floorToHour';
import { ALL_NAV_REGION_LINKS } from '@/shared/config/assetClassNav';
import { KR_EQUITY_SESSION } from '@/shared/api/market/sessionSpecFor';

const NOW = new Date('2026-05-23T15:30:00.000Z');

describe('buildStaticEntries', () => {
    it('홈 + 버티컬 지역 페이지 + backtesting + 뉴스 허브·지역·카테고리 + legal 전부를 반환한다', () => {
        const entries = buildStaticEntries(NOW);

        // 개수를 손으로 적지 않는다 — 지역을 하나 열 때마다 이 숫자만 고치게 되고
        // 정작 "빠진 URL"은 못 잡는다. 내비 설정에서 파생해 정합성을 강제한다.
        const urlSet = new Set(entries.map(e => e.url));
        for (const link of ALL_NAV_REGION_LINKS) {
            expect(urlSet).toContain(`${SITE_URL}${link.href}`);
        }
        expect(urlSet.size).toBe(entries.length); // 중복 URL 없음

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
            lastClosedSessionCloseUtc(US_EQUITY_SESSION, NOW).getTime()
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

    it('/market은 1시간 슬라이딩 lastmod(정시로 내림)를 적용한다', () => {
        const entries = buildStaticEntries(NOW);
        const market = entries.find(e => e.url.endsWith('/market'));
        expect(market).toBeDefined();
        expect(market!.lastModified.getTime()).toBe(
            floorToHour(new Date(NOW.getTime() - MS_PER_HOUR)).getTime()
        );
        expect(market!.changeFrequency).toBe('hourly');
    });

    /**
     * 회귀 가드(SEO 감사 finding 5): raw `now - 1h`였을 때는 같은 시간대 안에서도
     * 호출마다 값이 달라져 sitemap index lastmod의 freshness 신호가 무력화됐다.
     * `floorToHour` 적용 후로는 같은 시간대 안의 서로 다른 호출 시각이 동일한
     * lastmod를 내야 한다. `/fear-greed`(세션 앵커) 값은 이 픽스와 무관하게
     * 그대로 유지돼야 한다.
     */
    it('같은 시간대 안에서는 호출 시각이 달라도 market lastmod가 동일하다 (fear-greed는 그대로 유지)', () => {
        const a = buildStaticEntries(new Date('2026-05-23T15:00:05.000Z'));
        const b = buildStaticEntries(new Date('2026-05-23T15:59:55.000Z'));
        const marketOf = (es: ReturnType<typeof buildStaticEntries>) =>
            es.find(e => e.url.endsWith('/market'))!.lastModified.getTime();
        expect(marketOf(a)).toBe(marketOf(b));

        const fgOf = (es: ReturnType<typeof buildStaticEntries>) =>
            es.find(e => e.url.endsWith('/fear-greed'))!.lastModified.getTime();
        expect(fgOf(a)).toBe(fgOf(b));
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
            floorToHour(new Date(NOW.getTime() - MS_PER_HOUR)).getTime()
        );
    });
});

describe('buildStaticEntries — 지역별 lastmod', () => {
    /**
     * 두 공포·탐욕 페이지는 서로 다른 거래소의 EOD 종가가 입력이다. KRX는 06:30 UTC,
     * NYSE는 21:00 UTC에 닫혀서 한 시계로 통일하면 하루 14시간 넘게 KR 엔트리가 실제
     * 변경 시각보다 뒤처지고, KRX만 여는 날에는 바뀌지도 않은 변경을 주장한다.
     */
    it('/fear-greed/kr은 KRX 직전 마감을, /fear-greed는 NYSE 직전 마감을 쓴다', () => {
        const now = new Date('2026-08-18T12:00:00Z');
        const entries = buildStaticEntries(now);

        const us = entries.find(e => e.url.endsWith('/fear-greed'));
        const kr = entries.find(e => e.url.endsWith('/fear-greed/kr'));

        expect(us?.lastModified).toEqual(
            lastClosedSessionCloseUtc(US_EQUITY_SESSION, now)
        );
        expect(kr?.lastModified).toEqual(
            lastClosedSessionCloseUtc(KR_EQUITY_SESSION, now)
        );
        expect(kr?.lastModified).not.toEqual(us?.lastModified);
    });
});
