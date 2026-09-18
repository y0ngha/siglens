vi.mock('@/shared/lib/seo', () => ({
    SITE_BUILD_DATE: new Date('2025-01-01T00:00:00.000Z'),
    SITE_NAME: 'Siglens',
    SITE_URL: 'https://siglens.io',
}));

import { buildStaticEntries } from '../lib/buildStaticEntries';
import { SITE_URL } from '@/shared/lib/seo';
import { ABOUT_UPDATED_AT } from '@/shared/lib/legal';
import { US_EQUITY_SESSION } from '@y0ngha/siglens-core';
import { lastClosedSessionCloseUtc } from '@/shared/lib/marketSessionDate';
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

    it('/market은 직전 미국 정규장 마감을 lastmod로 쓴다', () => {
        const entries = buildStaticEntries(NOW);
        const market = entries.find(e => e.url.endsWith('/market'));
        expect(market).toBeDefined();
        expect(market!.lastModified.getTime()).toBe(
            lastClosedSessionCloseUtc(US_EQUITY_SESSION, NOW).getTime()
        );
        expect(market!.changeFrequency).toBe('hourly');
    });

    it('/market/kr은 직전 KRX 마감을 쓴다 — 미국과 다른 시각이다', () => {
        const entries = buildStaticEntries(NOW);
        const marketKr = entries.find(e => e.url.endsWith('/market/kr'));
        expect(marketKr).toBeDefined();
        expect(marketKr!.lastModified.getTime()).toBe(
            lastClosedSessionCloseUtc(KR_EQUITY_SESSION, NOW).getTime()
        );
        expect(marketKr!.lastModified.getTime()).not.toBe(
            lastClosedSessionCloseUtc(US_EQUITY_SESSION, NOW).getTime()
        );
    });

    /**
     * 회귀 가드(SEO 감사 M2): `/market*`은 "1시간 슬라이딩"이었다. 장이 닫힌
     * 주말에도 매시간 값이 앞으로 가 "방금 바뀌었다"는 거짓 freshness를 냈다.
     * NOW(2026-05-23)는 토요일이라, 세션 앵커라면 직전 금요일 마감에 고정된다.
     */
    it('주말에는 호출 시각이 달라도 market lastmod가 직전 금요일 마감에 고정된다', () => {
        const saturdayMorning = new Date('2026-05-23T00:10:00.000Z');
        const saturdayNight = new Date('2026-05-23T23:50:00.000Z');
        const marketOf = (now: Date) =>
            buildStaticEntries(now)
                .find(e => e.url.endsWith('/market'))!
                .lastModified.getTime();

        expect(marketOf(saturdayMorning)).toBe(marketOf(saturdayNight));
        expect(marketOf(saturdayNight)).toBe(
            lastClosedSessionCloseUtc(
                US_EQUITY_SESSION,
                saturdayNight
            ).getTime()
        );
        // 마감은 항상 과거다 — 열리지도 않은 장의 마감을 주장하지 않는다.
        expect(marketOf(saturdayNight)).toBeLessThan(saturdayNight.getTime());
    });

    /** 미국 휴장(2026-01-01 신정)에 KRX만 여는 날은 두 값이 갈려야 한다. */
    it('미국 휴장일에도 /market은 그 이전 마감으로 되감긴다', () => {
        const holiday = new Date('2026-01-01T18:00:00.000Z');
        const market = buildStaticEntries(holiday).find(e =>
            e.url.endsWith('/market')
        );
        expect(market!.lastModified.getTime()).toBe(
            lastClosedSessionCloseUtc(US_EQUITY_SESSION, holiday).getTime()
        );
        expect(market!.lastModified.getUTCFullYear()).toBe(2025);
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

    it('/about은 yearly, legal보다 한 단계 높은 priority 0.4', () => {
        const entries = buildStaticEntries(NOW);
        const about = entries.filter(e => e.url.endsWith('/about'));
        expect(about).toHaveLength(1);
        expect(about[0].url).toBe('https://siglens.io/about');
        expect(about[0].changeFrequency).toBe('yearly');
        expect(about[0].priority).toBe(0.4);
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
     * 크롤러가 가져갈 때마다 값이 바뀐다. 어떤 엔트리도 요청 시각을 그대로 쓰지 않는다.
     */
    it('어떤 엔트리도 요청 시각을 그대로 lastmod로 쓰지 않는다', () => {
        const entries = buildStaticEntries(NOW);
        const usingNow = entries.filter(
            e => e.lastModified.getTime() === NOW.getTime()
        );
        expect(usingNow).toEqual([]);
    });

    it('/about은 본문 갱신 상수(ABOUT_UPDATED_AT)를 lastmod로 쓴다', () => {
        const about = buildStaticEntries(NOW).find(e =>
            e.url.endsWith('/about')
        );
        expect(about!.lastModified.getTime()).toBe(ABOUT_UPDATED_AT.getTime());
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

describe('buildStaticEntries — 주입된 콘텐츠 갱신 시각', () => {
    const CRYPTO_NEWS_AT = new Date('2026-05-23T11:00:00.000Z');
    const STOCK_NEWS_AT = new Date('2026-05-23T09:00:00.000Z');

    it('카테고리 lastmod는 그 버킷의 최신 기사 시각을 쓴다', () => {
        const entries = buildStaticEntries(NOW, {
            newsLatestPublishedAt: { crypto: CRYPTO_NEWS_AT },
        });
        const crypto = entries.find(e => e.url === `${SITE_URL}/news/crypto`);
        expect(crypto!.lastModified.getTime()).toBe(CRYPTO_NEWS_AT.getTime());
    });

    it('주입되지 않은 카테고리는 UTC 일 경계로 떨어진다', () => {
        const entries = buildStaticEntries(NOW, {
            newsLatestPublishedAt: { crypto: CRYPTO_NEWS_AT },
        });
        const general = entries.find(e => e.url === `${SITE_URL}/news/general`);
        expect(general!.lastModified.getTime()).toBe(
            new Date('2026-05-23T00:00:00.000Z').getTime()
        );
    });

    /**
     * 허브는 자기가 나열하는 카테고리의 최댓값이다. `/news`는 전 지역이라
     * 암호화폐(11:00Z)를, `/news/us`는 미국 카테고리만 보므로 주식(09:00Z)을 쓴다 —
     * 허브가 카테고리보다 신선하다고 주장할 수 없다.
     */
    it('/news는 전체 최댓값, /news/us는 미국 카테고리 최댓값을 쓴다', () => {
        const entries = buildStaticEntries(NOW, {
            newsLatestPublishedAt: {
                crypto: CRYPTO_NEWS_AT,
                stock: STOCK_NEWS_AT,
            },
        });
        const hub = entries.find(e => e.url === `${SITE_URL}/news`);
        const us = entries.find(e => e.url === `${SITE_URL}/news/us`);
        expect(hub!.lastModified.getTime()).toBe(CRYPTO_NEWS_AT.getTime());
        expect(us!.lastModified.getTime()).toBe(STOCK_NEWS_AT.getTime());
    });

    /**
     * 2026-09-17 운영 크롤: `/news/forex`가 3주째 기사 없는 빈 카테고리라 페이지는
     * noindex인데 sitemap에는 실려 있었다. sitemap은 색인 대상만 실어야 한다.
     */
    it('마지막 기사가 14일보다 오래된 카테고리는 싣지 않는다', () => {
        const staleAt = new Date('2026-05-01T00:00:00.000Z'); // NOW - 22일
        const entries = buildStaticEntries(NOW, {
            newsLatestPublishedAt: {
                forex: staleAt,
                crypto: CRYPTO_NEWS_AT,
            },
        });
        const urls = entries.map(e => e.url);
        expect(urls).not.toContain(`${SITE_URL}/news/forex`);
        expect(urls).toContain(`${SITE_URL}/news/crypto`);
    });

    // 경계: 정확히 14일이면 뺀다(`<` 비교), 1초 모자라면 싣는다.
    it.each([
        ['14일 정각', 14 * 24 * 60 * 60 * 1000, false],
        ['14일에서 1초 모자람', 14 * 24 * 60 * 60 * 1000 - 1000, true],
    ])('%s 지난 카테고리 포함 여부=%s', (_label, ageMs, included) => {
        const entries = buildStaticEntries(NOW, {
            newsLatestPublishedAt: {
                forex: new Date(NOW.getTime() - (ageMs as number)),
            },
        });
        expect(entries.map(e => e.url).includes(`${SITE_URL}/news/forex`)).toBe(
            included
        );
    });

    it('최신 기사 시각을 못 읽은 카테고리는 그대로 싣는다 (로더 장애로 sitemap이 비지 않게)', () => {
        const entries = buildStaticEntries(NOW, {
            newsLatestPublishedAt: { crypto: CRYPTO_NEWS_AT },
        });
        expect(entries.map(e => e.url)).toContain(`${SITE_URL}/news/forex`);
    });

    /**
     * `/backtesting` 본문은 고정 데이터라 배포로 바뀌지 않는다 — 릴리스 시각을
     * lastmod로 쓰면 매 배포마다 "방금 바뀜"을 주장하게 된다.
     */
    it('/backtesting은 주입된 데이터 날짜를 쓰고, 없으면 빌드 시각으로 떨어진다', () => {
        const dataAt = new Date('2026-03-31T00:00:00.000Z');
        const withData = buildStaticEntries(NOW, {
            backtestingDataDate: dataAt,
        });
        const withoutData = buildStaticEntries(NOW);
        expect(
            withData
                .find(e => e.url === `${SITE_URL}/backtesting`)!
                .lastModified.getTime()
        ).toBe(dataAt.getTime());
        expect(
            withoutData
                .find(e => e.url === `${SITE_URL}/backtesting`)!
                .lastModified.getTime()
        ).toBe(new Date('2025-01-01T00:00:00.000Z').getTime());
    });

    /**
     * `/economy*`의 지표는 하루 주기로 갱신된다(페이지 FAQ가 그렇게 밝힌다).
     * 배포 시각을 쓰면 하루 세 번 배포한 날 세 번 바뀌었다고 주장하게 된다.
     */
    it('/economy는 배포 시각이 아니라 UTC 일 경계를 쓴다', () => {
        const entries = buildStaticEntries(NOW);
        const economy = entries.find(e => e.url === `${SITE_URL}/economy`);
        expect(economy!.lastModified.getTime()).toBe(
            new Date('2026-05-23T00:00:00.000Z').getTime()
        );
    });

    it('legal 엔트리는 활성 약관 발효일을 쓰고, 없으면 빌드 시각으로 떨어진다', () => {
        const tosAt = new Date('2026-09-14T00:00:00.000Z');
        const entries = buildStaticEntries(NOW, {
            legalEffectiveDates: { tos: tosAt },
        });
        const terms = entries.find(e => e.url === `${SITE_URL}/terms`);
        const privacy = entries.find(e => e.url === `${SITE_URL}/privacy`);
        expect(terms!.lastModified.getTime()).toBe(tosAt.getTime());
        expect(privacy!.lastModified.getTime()).toBe(
            new Date('2025-01-01T00:00:00.000Z').getTime()
        );
    });
});
