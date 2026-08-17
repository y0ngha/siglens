import { POPULAR_OPTIONS_TICKERS } from '../config/popular-options-tickers';
import { POPULAR_TICKERS } from '@/shared/config/popular-tickers';
import { MS_PER_HOUR } from '@/shared/config/time';
import { SITE_URL } from '@/shared/lib/seo';
import { buildPopularEntries } from '../lib/buildPopularEntries';

// 2026-05-23은 **토요일**이다. 직전 마감 세션은 금요일(2026-05-22) 20:00 UTC.
const NOW = new Date('2026-05-23T21:00:00.000Z');
/** 직전 마감 세션(금 2026-05-22) 마감 순간. 여름이라 20:00 UTC. */
const LAST_SESSION_CLOSE = new Date('2026-05-22T20:00:00.000Z');

describe('buildPopularEntries', () => {
    it('모든 POPULAR_TICKERS에 대해 7축 기본 라우트를 생성하고 options는 generated list에 맞춘다', () => {
        const entries = buildPopularEntries(NOW);

        // 한국 종목은 `/congress`가 없어(국내에 공직자 매매 공시 제도가 없다) 6축이다.
        const krCount = POPULAR_TICKERS.filter(t => /\.K[SQ]$/.test(t)).length;
        expect(entries).toHaveLength(
            POPULAR_TICKERS.length * 7 -
                krCount +
                POPULAR_OPTIONS_TICKERS.length
        );

        const first = POPULAR_TICKERS[0];
        const base = `${SITE_URL}/${first}`;
        const urls = entries.map(e => e.url);
        expect(urls).toEqual(
            expect.arrayContaining([
                base,
                `${base}/news`,
                `${base}/fundamental`,
                `${base}/financials`,
                `${base}/overall`,
                `${base}/fear-greed`,
                `${base}/congress`,
            ])
        );

        // 한국 종목은 존재하지 않는 `/congress`가 sitemap에 실리면 안 된다 —
        // 404 URL은 크롤 예산을 태우고 색인 품질 신호를 떨어뜨린다.
        expect(urls).not.toContain(`${SITE_URL}/005930.KS/congress`);
        expect(urls).toEqual(
            expect.arrayContaining([
                `${SITE_URL}/005930.KS`,
                `${SITE_URL}/005930.KS/financials`,
            ])
        );

        const congressEntry = entries.find(e => e.url === `${base}/congress`);
        expect(congressEntry?.changeFrequency).toBe('weekly');
        expect(congressEntry?.priority).toBe(0.75);
    });

    it('옵션 URL은 generated static options list와 정확히 일치한다', () => {
        const entries = buildPopularEntries(NOW);
        const optionsSymbols = entries
            .filter(entry => entry.url.endsWith('/options'))
            .map(entry => entry.url.split('/')[3])
            .toSorted();

        expect(optionsSymbols).toEqual([...POPULAR_OPTIONS_TICKERS]);
    });

    it('news 페이지는 1시간 슬라이딩 lastmod와 hourly changefreq를 적용한다', () => {
        const entries = buildPopularEntries(NOW);

        const newsEntry = entries.find(e => e.url.endsWith('/news'));
        expect(newsEntry).toBeDefined();
        expect(newsEntry!.lastModified.getTime()).toBe(
            NOW.getTime() - MS_PER_HOUR
        );
        expect(newsEntry!.changeFrequency).toBe('hourly');
    });

    it('chart 페이지는 daily, fundamental은 weekly로 우선순위를 둔다', () => {
        const entries = buildPopularEntries(NOW);

        const first = POPULAR_TICKERS[0];
        const chart = entries.find(e => e.url === `${SITE_URL}/${first}`);
        const fundamental = entries.find(
            e => e.url === `${SITE_URL}/${first}/fundamental`
        );
        expect(chart?.changeFrequency).toBe('daily');
        expect(fundamental?.changeFrequency).toBe('weekly');
    });

    it('마감 전 호출이면 직전 마감 세션으로 클램프된다', () => {
        const beforeClose = new Date('2026-05-23T15:00:00.000Z');
        const entries = buildPopularEntries(beforeClose);

        const chart = entries.find(
            e => e.url === `${SITE_URL}/${POPULAR_TICKERS[0]}`
        );
        expect(chart!.lastModified.getTime()).toBe(
            LAST_SESSION_CLOSE.getTime()
        );
    });

    /**
     * 회귀 가드: 예전 `computeTodayAtMarketClose`는 요일을 보지 않아, 토요일
     * 20:00 UTC를 넘긴 시각에 크롤되면 **열리지도 않은 토요일 장의 마감 시각**을
     * lastmod로 발행했다(POPULAR_TICKERS × 7축 ≈ 1800여 URL 전부).
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
            const day = entry.lastModified.getUTCDay();
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
                .lastModified.getTime();

        expect(pick(sat)).toBe(LAST_SESSION_CLOSE.getTime());
        expect(pick(sun)).toBe(LAST_SESSION_CLOSE.getTime());
    });

    it('겨울(EST) 세션은 21:00 UTC 마감으로 나온다', () => {
        // 2026-01-13 01:30Z = 20:30 EST Mon 1/12 (마감+버퍼 경과) → 세션 1/12
        const entries = buildPopularEntries(new Date('2026-01-13T01:30:00Z'));
        const chart = entries.find(
            e => e.url === `${SITE_URL}/${POPULAR_TICKERS[0]}`
        );
        expect(chart!.lastModified.toISOString()).toBe(
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
    ) => entries.find(e => e.url === url)!.lastModified;

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
