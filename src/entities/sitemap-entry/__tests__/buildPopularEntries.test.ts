import { POPULAR_OPTIONS_TICKERS } from '../config/popular-options-tickers';
import { POPULAR_TICKERS } from '@/shared/config/popular-tickers';
import { MS_PER_HOUR } from '@/shared/config/time';
import { SITE_URL } from '@/shared/lib/seo';
import { buildPopularEntries } from '../lib/buildPopularEntries';

// 미국 장 마감 직후 시각이라 todayClose가 오늘 close가 되도록 21:00 UTC로 고정
// (시장 마감 20:00 UTC 직후).
const NOW = new Date('2026-05-23T21:00:00.000Z');

describe('buildPopularEntries', () => {
    it('모든 POPULAR_TICKERS에 대해 7축 기본 라우트를 생성하고 options는 generated list에 맞춘다', () => {
        const entries = buildPopularEntries(NOW);

        expect(entries).toHaveLength(
            POPULAR_TICKERS.length * 7 + POPULAR_OPTIONS_TICKERS.length
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

    it('하루 중 시장 마감 전(20:00 UTC 이전) 호출이면 어제 close로 클램프된다', () => {
        const beforeClose = new Date('2026-05-23T15:00:00.000Z'); // 미국 장중
        const entries = buildPopularEntries(beforeClose);

        const chart = entries.find(
            e => e.url === `${SITE_URL}/${POPULAR_TICKERS[0]}`
        );
        // 어제 20:00 UTC
        const yesterdayClose = new Date('2026-05-22T20:00:00.000Z');
        expect(chart!.lastModified.getTime()).toBe(yesterdayClose.getTime());
    });
});
