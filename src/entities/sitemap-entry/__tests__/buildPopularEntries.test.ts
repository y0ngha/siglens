import { POPULAR_TICKERS } from '@/shared/config/popular-tickers';
import { MS_PER_HOUR } from '@/shared/config/time';
import { SITE_URL } from '@/shared/lib/seo';
import { floorToHour } from '../lib/floorToHour';
import { buildPopularEntries } from '../lib/buildPopularEntries';

// 2026-05-23은 **토요일**이다. 직전 마감 세션은 금요일(2026-05-22) 20:00 UTC.
const NOW = new Date('2026-05-23T21:00:00.000Z');
/** 직전 마감 세션(금 2026-05-22) 마감 순간. 여름이라 20:00 UTC. */
const LAST_SESSION_CLOSE = new Date('2026-05-22T20:00:00.000Z');

describe('buildPopularEntries', () => {
    // 2026-09-17 운영 크롤: noindex 탭이 sitemap에 실렸다. 산문 게이트 대상은 차트·뉴스이고,
    // 산문 보유 집합이 있으면 두 탭이 거기 맞춰진다. 공포탐욕은 산문이 없는 탭이라 그대로다.
    it('산문 스냅샷 집합이 주어지면 차트·뉴스는 그 종목만 싣고 공포탐욕은 그대로 둔다', () => {
        const urls = buildPopularEntries(NOW, {
            snapshotGeneratedAt: new Map([
                ['AAPL:news', new Date('2026-05-22T09:00:00.000Z')],
                ['AAPL:technical', new Date('2026-05-22T09:00:00.000Z')],
                ['MSFT:technical', new Date('2026-05-22T09:00:00.000Z')],
            ]),
        }).map(e => e.url);

        // 집합에 든 조합은 실제로 실린다 — 키 형식이 어긋나면 이 단언이 깨진다.
        expect(urls).toContain(`${SITE_URL}/AAPL/news`);
        expect(urls).toContain(`${SITE_URL}/AAPL`);
        // 2026-09-18: 산문 없는 종목의 /news가 sitemap에 noindex로 남아 있었다.
        expect(urls).not.toContain(`${SITE_URL}/MSFT/news`);
        expect(urls).toContain(`${SITE_URL}/MSFT`);
        // technical 산문이 없는 종목은 차트 탭도 빠진다(페이지 no-prose).
        expect(urls).not.toContain(`${SITE_URL}/NVDA`);
        expect(urls).toContain(`${SITE_URL}/MSFT/fear-greed`);
        expect(urls).toContain(`${SITE_URL}/NVDA/fear-greed`);
    });

    it('산문 집합이 없으면(로더 실패) news를 전부 싣는다', () => {
        const urls = buildPopularEntries(NOW).map(e => e.url);

        expect(urls).toContain(`${SITE_URL}/MSFT/news`);
    });

    it('모든 POPULAR_TICKERS에 대해 차트·뉴스·공포탐욕 3축 라우트만 생성한다', () => {
        const entries = buildPopularEntries(NOW);

        expect(entries).toHaveLength(POPULAR_TICKERS.length * 3);

        const first = POPULAR_TICKERS[0];
        const base = `${SITE_URL}/${first}`;
        const urls = entries.map(e => e.url);
        expect(urls).toEqual(
            expect.arrayContaining([base, `${base}/news`, `${base}/fear-greed`])
        );

        const fearGreed = entries.find(e => e.url === `${base}/fear-greed`);
        expect(fearGreed?.changeFrequency).toBe('daily');
        expect(fearGreed?.priority).toBe(0.75);
    });

    // 종합·펀더멘털·재무제표·옵션·의회거래·내위치 탭은 페이지가 항상 noindex다.
    // noindex URL이 sitemap에 실리면 크롤 예산만 태우므로 한 건도 나가지 않는지
    // (한국 종목·ETF 포함) 고정한다.
    it.each([
        'overall',
        'fundamental',
        'financials',
        'options',
        'congress',
        'position',
    ])('`/%s` 엔트리를 한 건도 내지 않는다', tab => {
        const entries = buildPopularEntries(NOW);
        expect(entries.some(entry => entry.url.endsWith(`/${tab}`))).toBe(
            false
        );
    });

    it('news 페이지는 1시간 슬라이딩 lastmod(정시로 내림)와 hourly changefreq를 적용한다', () => {
        const entries = buildPopularEntries(NOW);

        const newsEntry = entries.find(e => e.url.endsWith('/news'));
        expect(newsEntry).toBeDefined();
        expect(newsEntry!.lastModified?.getTime()).toBe(
            floorToHour(new Date(NOW.getTime() - MS_PER_HOUR)).getTime()
        );
        expect(newsEntry!.changeFrequency).toBe('hourly');
    });

    /**
     * 회귀 가드(SEO 감사 finding 5): `/news` lastmod가 raw `now - 1h`였을 때는
     * 같은 시간대 안에서도 호출마다 값이 달라져(sitemap 라우트가 force-dynamic),
     * `maxLastModified`가 고르는 sitemap index lastmod가 끝없이 "방금 바뀜"으로
     * 나갔다. `floorToHour`로 정시 내림한 뒤로는 같은 시간대 안의 서로 다른 호출
     * 시각이 동일한 lastmod를 내야 한다. 세션 기반 엔트리(us/kr)는 이 픽스와
     * 무관하게 원래도 거래소별로 다른 고정 시각을 유지해야 한다.
     */
    it('같은 시간대 안에서는 호출 시각이 달라도 news lastmod가 동일하다 (US/KR 세션 엔트리는 그대로 구분됨)', () => {
        // NOW = 2026-05-23T21:00:00Z. 같은 21시대 안에서 분만 다른 두 시각.
        const a = buildPopularEntries(new Date('2026-05-23T21:00:05.000Z'));
        const b = buildPopularEntries(new Date('2026-05-23T21:59:55.000Z'));

        const newsOf = (es: ReturnType<typeof buildPopularEntries>) =>
            es.find(e => e.url.endsWith('/news'))!.lastModified?.getTime();
        expect(newsOf(a)).toBe(newsOf(b));

        // US/KR 세션 앵커 엔트리는 news 픽스와 독립적으로 여전히 서로 다른 값을 유지한다.
        const usTicker = POPULAR_TICKERS.find(t => !/\.K[SQ]$/.test(t))!;
        const krTicker = POPULAR_TICKERS.find(t => /\.K[SQ]$/.test(t))!;
        const chartOf = (
            es: ReturnType<typeof buildPopularEntries>,
            ticker: string
        ) => es.find(e => e.url === `${SITE_URL}/${ticker}`)!.lastModified!;
        expect(chartOf(a, usTicker).getTime()).not.toBe(
            chartOf(a, krTicker).getTime()
        );
    });

    it('chart 페이지와 fear-greed는 daily로, 같은 lastmod를 쓴다', () => {
        const entries = buildPopularEntries(NOW);

        const first = POPULAR_TICKERS[0];
        const chart = entries.find(e => e.url === `${SITE_URL}/${first}`);
        const fearGreed = entries.find(
            e => e.url === `${SITE_URL}/${first}/fear-greed`
        );
        expect(chart?.changeFrequency).toBe('daily');
        expect(chart?.priority).toBe(0.8);
        expect(fearGreed?.changeFrequency).toBe('daily');
        expect(fearGreed?.lastModified?.getTime()).toBe(
            chart?.lastModified?.getTime()
        );
    });

    it('마감 전 호출이면 직전 마감 세션으로 클램프된다', () => {
        const beforeClose = new Date('2026-05-23T15:00:00.000Z');
        const entries = buildPopularEntries(beforeClose);

        const chart = entries.find(
            e => e.url === `${SITE_URL}/${POPULAR_TICKERS[0]}`
        );
        expect(chart!.lastModified?.getTime()).toBe(
            LAST_SESSION_CLOSE.getTime()
        );
    });

    /**
     * 회귀 가드: 예전 `computeTodayAtMarketClose`는 요일을 보지 않아, 토요일
     * 20:00 UTC를 넘긴 시각에 크롤되면 **열리지도 않은 토요일 장의 마감 시각**을
     * lastmod로 발행했다(POPULAR_TICKERS의 모든 URL).
     *
     * `/news`는 의도적으로 1시간 슬라이딩이라 주말 날짜가 나오는 게 정상 — 제외한다.
     */
    it.each([
        ['토요일 늦은 시각', '2026-05-23T23:00:00.000Z'],
        ['일요일', '2026-05-24T12:00:00.000Z'],
    ])('%s에도 세션 기반 엔트리는 주말 날짜를 쓰지 않는다', (_label, iso) => {
        const sessionEntries = buildPopularEntries(new Date(iso)).filter(
            e => !e.url.endsWith('/news')
        );
        expect(sessionEntries.length).toBeGreaterThan(0);

        for (const entry of sessionEntries) {
            const day = entry.lastModified!.getUTCDay();
            expect(day).not.toBe(0); // Sunday
            expect(day).not.toBe(6); // Saturday
        }
    });

    it('주말 내내 lastmod가 직전 금요일 마감으로 고정된다 (슬라이딩 아님)', () => {
        const sat = buildPopularEntries(new Date('2026-05-23T23:00:00.000Z'));
        const sun = buildPopularEntries(new Date('2026-05-24T12:00:00.000Z'));
        const pick = (es: ReturnType<typeof buildPopularEntries>) =>
            es
                .find(e => e.url === `${SITE_URL}/${POPULAR_TICKERS[0]}`)!
                .lastModified?.getTime();

        expect(pick(sat)).toBe(LAST_SESSION_CLOSE.getTime());
        expect(pick(sun)).toBe(LAST_SESSION_CLOSE.getTime());
    });

    it('겨울(EST) 세션은 21:00 UTC 마감으로 나온다', () => {
        // 2026-01-13 01:30Z = 20:30 EST Mon 1/12 (마감+버퍼 경과) → 세션 1/12
        const entries = buildPopularEntries(new Date('2026-01-13T01:30:00Z'));
        const chart = entries.find(
            e => e.url === `${SITE_URL}/${POPULAR_TICKERS[0]}`
        );
        expect(chart!.lastModified?.toISOString()).toBe(
            '2026-01-12T21:00:00.000Z'
        );
    });
});

/**
 * lastmod는 종목이 상장된 거래소의 세션을 따라야 한다.
 *
 * 한 벌(미국)만 쓰면 한국 종목 lastmod가 KRX 마감이 아니라 NYSE 마감으로 나가고,
 * NYSE만 쉬는 날(추수감사절 등)에는 KRX가 정상 개장했는데도 하루 전으로 되감긴다.
 */
describe('buildPopularEntries — 거래소별 lastmod', () => {
    const KR_TICKER = POPULAR_TICKERS.find(t => /\.K[SQ]$/.test(t));
    const US_TICKER = POPULAR_TICKERS.find(t => !/\.K[SQ]$/.test(t));

    const lastModOf = (
        entries: ReturnType<typeof buildPopularEntries>,
        url: string
    ) => entries.find(e => e.url === url)!.lastModified!;

    it('한국 종목은 KRX 마감(15:30 KST = 06:30 UTC)을 lastmod로 쓴다', () => {
        expect(KR_TICKER).toBeDefined();
        // 2026-11-27(금) 01:00Z = 10:00 KST — KRX 11/26 세션 마감+버퍼 경과.
        const entries = buildPopularEntries(
            new Date('2026-11-27T01:00:00.000Z')
        );
        expect(
            lastModOf(entries, `${SITE_URL}/${KR_TICKER}`).toISOString()
        ).toBe('2026-11-26T06:30:00.000Z');
    });

    it('추수감사절에 미국 종목만 되감기고 한국 종목은 당일 마감을 유지한다', () => {
        const entries = buildPopularEntries(
            new Date('2026-11-27T01:00:00.000Z')
        );
        // 미국: 11/26 휴장 → 11/25 16:00 EST = 21:00 UTC
        expect(
            lastModOf(entries, `${SITE_URL}/${US_TICKER}`).toISOString()
        ).toBe('2026-11-25T21:00:00.000Z');
        // 한국: 11/26 정상 개장
        expect(
            lastModOf(entries, `${SITE_URL}/${KR_TICKER}`).toISOString()
        ).toBe('2026-11-26T06:30:00.000Z');
    });
});

/**
 * 2차 lastmod 정직화(2026-10-04). 실측(주말): 뉴스 탭 365개 전부가 `now − 1h`였는데
 * 페이지에 렌더되는 뉴스 스냅샷은 중앙값 32시간 전에 구워진 것이었다. 차트 탭은 세션
 * 마감을 광고했지만 technical 산문은 마감 1.7~3.7시간 **뒤**에 구워진다.
 */
describe('buildPopularEntries — 스냅샷 generatedAt lastmod', () => {
    const NEWS_AT = new Date('2026-05-22T09:30:00.000Z'); // 토요일 NOW보다 32시간쯤 전
    const KR_TICKER = POPULAR_TICKERS.find(t => /\.K[SQ]$/.test(t))!;
    const US_TICKER = POPULAR_TICKERS.find(t => !/\.K[SQ]$/.test(t))!;

    const lastModOf = (
        entries: ReturnType<typeof buildPopularEntries>,
        url: string
    ) => entries.find(e => e.url === url)!.lastModified!;

    it('뉴스 탭 lastmod는 그 종목 뉴스 스냅샷의 generatedAt이다 — now − 1h가 아니다', () => {
        const entries = buildPopularEntries(NOW, {
            snapshotGeneratedAt: new Map([
                [`${US_TICKER}:news`, NEWS_AT],
                ['MSFT:news', new Date('2026-05-23T01:00:00.000Z')],
            ]),
        });

        expect(
            lastModOf(entries, `${SITE_URL}/${US_TICKER}/news`).toISOString()
        ).toBe(NEWS_AT.toISOString());
        // 종목마다 자기 값이다 — 한 값으로 뭉개지지 않는다.
        expect(lastModOf(entries, `${SITE_URL}/MSFT/news`).toISOString()).toBe(
            '2026-05-23T01:00:00.000Z'
        );
        expect(NEWS_AT.getTime()).not.toBe(
            floorToHour(new Date(NOW.getTime() - MS_PER_HOUR)).getTime()
        );
    });

    it('스냅샷 맵이 없으면(DB 읽기 실패) 뉴스 탭은 예전 폴백 now − 1h(정시 내림)로 간다', () => {
        const entries = buildPopularEntries(NOW);

        expect(
            lastModOf(entries, `${SITE_URL}/${US_TICKER}/news`).getTime()
        ).toBe(floorToHour(new Date(NOW.getTime() - MS_PER_HOUR)).getTime());
    });

    it('차트 탭 lastmod는 세션 마감과 technical 스냅샷 중 늦은 쪽이다 (스냅샷이 마감보다 늦은 경우)', () => {
        // 금 마감 20:00Z + 2.5시간 = 22:30Z
        const technicalAt = new Date('2026-05-22T22:30:00.000Z');
        const entries = buildPopularEntries(NOW, {
            snapshotGeneratedAt: new Map([
                [`${US_TICKER}:technical`, technicalAt],
            ]),
        });

        expect(
            lastModOf(entries, `${SITE_URL}/${US_TICKER}`).toISOString()
        ).toBe(technicalAt.toISOString());
        // 공포탐욕 탭은 스냅샷 산문이 없으므로 세션 마감 그대로다.
        expect(
            lastModOf(
                entries,
                `${SITE_URL}/${US_TICKER}/fear-greed`
            ).toISOString()
        ).toBe(LAST_SESSION_CLOSE.toISOString());
    });

    it('technical 스냅샷이 세션 마감보다 이르면 세션 마감을 유지한다', () => {
        const entries = buildPopularEntries(NOW, {
            snapshotGeneratedAt: new Map([
                [
                    `${US_TICKER}:technical`,
                    new Date('2026-05-22T10:00:00.000Z'),
                ],
            ]),
        });

        expect(
            lastModOf(entries, `${SITE_URL}/${US_TICKER}`).toISOString()
        ).toBe(LAST_SESSION_CLOSE.toISOString());
    });

    it('technical 산문이 없는 종목은 차트 탭이 sitemap에서 빠진다 — 페이지가 noindex(no-prose)다', () => {
        const entries = buildPopularEntries(NOW, {
            snapshotGeneratedAt: new Map([
                ['MSFT:technical', new Date('2026-05-22T22:30:00.000Z')],
            ]),
        });

        const urls = entries.map(e => e.url);
        expect(urls).not.toContain(`${SITE_URL}/${US_TICKER}`);
        // 산문이 있는 종목은 싣는다.
        expect(urls).toContain(`${SITE_URL}/MSFT`);
    });

    it('한국 종목도 자기 거래소 세션 마감과 겨룬다', () => {
        // KRX 마감은 토요일 NOW 기준 금요일 06:30Z. 스냅샷이 그보다 늦다.
        const technicalAt = new Date('2026-05-22T09:00:00.000Z');
        const entries = buildPopularEntries(NOW, {
            snapshotGeneratedAt: new Map([
                [`${KR_TICKER}:technical`, technicalAt],
            ]),
        });

        expect(
            lastModOf(entries, `${SITE_URL}/${KR_TICKER}`).toISOString()
        ).toBe(technicalAt.toISOString());
    });

    it('맵이 비어 있으면(산문 없음) 차트·뉴스 탭은 빠지고 공포탐욕은 세션 마감으로 남는다', () => {
        const entries = buildPopularEntries(NOW, {
            snapshotGeneratedAt: new Map(),
        });

        expect(entries.some(e => e.url.endsWith('/news'))).toBe(false);
        expect(entries.some(e => e.url === `${SITE_URL}/${US_TICKER}`)).toBe(
            false
        );
        expect(
            lastModOf(
                entries,
                `${SITE_URL}/${US_TICKER}/fear-greed`
            ).toISOString()
        ).toBe(LAST_SESSION_CLOSE.toISOString());
    });
});
