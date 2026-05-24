jest.mock('@/entities/options-chain', () => ({
    hasOptionsMarket: jest.fn(),
}));

import { POPULAR_TICKERS } from '@/shared/config/popular-tickers';
import { MS_PER_HOUR } from '@/shared/config/time';
import { hasOptionsMarket } from '@/entities/options-chain';
import { buildPopularEntries } from '../lib/buildPopularEntries';
import { SITE_URL } from '@/shared/lib/seo';

const mockedHasOptionsMarket = hasOptionsMarket as jest.MockedFunction<
    typeof hasOptionsMarket
>;

// 미국 장 마감 직후 시각이라 todayClose가 오늘 close가 되도록 21:00 UTC로 고정
// (시장 마감 20:00 UTC 직후).
const NOW = new Date('2026-05-23T21:00:00.000Z');

describe('buildPopularEntries', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('모든 POPULAR_TICKERS에 대해 chart/news/fundamental/overall/fear-greed 5축 + options(옵션 있을 때) 라우트를 생성한다', async () => {
        mockedHasOptionsMarket.mockResolvedValue(true);
        const entries = await buildPopularEntries(NOW);

        // ticker당 6개 라우트 (옵션 포함)
        expect(entries).toHaveLength(POPULAR_TICKERS.length * 6);

        // 첫 ticker의 6 라우트 확인 (url을 base와 비교)
        const first = POPULAR_TICKERS[0];
        const base = `${SITE_URL}/${first}`;
        const urls = entries.map(e => e.url);
        expect(urls).toEqual(
            expect.arrayContaining([
                base,
                `${base}/news`,
                `${base}/fundamental`,
                `${base}/options`,
                `${base}/overall`,
                `${base}/fear-greed`,
            ])
        );
    });

    it('옵션이 없는 ticker는 /options 라우트를 제외한다', async () => {
        mockedHasOptionsMarket.mockResolvedValue(false);
        const entries = await buildPopularEntries(NOW);

        // ticker당 5개 라우트 (옵션 제외)
        expect(entries).toHaveLength(POPULAR_TICKERS.length * 5);
        expect(entries.find(e => e.url.endsWith('/options'))).toBeUndefined();
    });

    it('news 페이지는 1시간 슬라이딩 lastmod와 hourly changefreq를 적용한다', async () => {
        mockedHasOptionsMarket.mockResolvedValue(false);
        const entries = await buildPopularEntries(NOW);

        const newsEntry = entries.find(e => e.url.endsWith('/news'));
        expect(newsEntry).toBeDefined();
        expect(newsEntry!.lastModified.getTime()).toBe(
            NOW.getTime() - MS_PER_HOUR
        );
        expect(newsEntry!.changeFrequency).toBe('hourly');
    });

    it('chart 페이지는 daily, fundamental은 weekly로 우선순위를 둔다', async () => {
        mockedHasOptionsMarket.mockResolvedValue(false);
        const entries = await buildPopularEntries(NOW);

        const first = POPULAR_TICKERS[0];
        const chart = entries.find(e => e.url === `${SITE_URL}/${first}`);
        const fundamental = entries.find(
            e => e.url === `${SITE_URL}/${first}/fundamental`
        );
        expect(chart?.changeFrequency).toBe('daily');
        expect(fundamental?.changeFrequency).toBe('weekly');
    });

    it('하루 중 시장 마감 전(20:00 UTC 이전) 호출이면 어제 close로 클램프된다', async () => {
        mockedHasOptionsMarket.mockResolvedValue(false);
        const beforeClose = new Date('2026-05-23T15:00:00.000Z'); // 미국 장중
        const entries = await buildPopularEntries(beforeClose);

        const chart = entries.find(
            e => e.url === `${SITE_URL}/${POPULAR_TICKERS[0]}`
        );
        // 어제 20:00 UTC
        const yesterdayClose = new Date('2026-05-22T20:00:00.000Z');
        expect(chart!.lastModified.getTime()).toBe(yesterdayClose.getTime());
    });
});
