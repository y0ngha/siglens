vi.mock('@/shared/lib/seo', () => ({
    SITE_URL: 'https://siglens.io',
}));

import {
    buildLongTailEntries,
    LONGTAIL_CHART_PRIORITY,
    LONGTAIL_LOW_PRIORITY,
    LONGTAIL_SUB_PRIORITY,
} from '../lib/buildLongTailEntries';
import { LONGTAIL_ENTRIES_PER_TICKER } from '../model';

const BUILD_DATE = new Date('2026-01-15T00:00:00.000Z');

describe('buildLongTailEntries', () => {
    it('티커 1개 → 5개 엔트리(chart, news, fundamental, overall, fear-greed)를 반환한다', () => {
        const entries = buildLongTailEntries(['AAPL'], BUILD_DATE);
        expect(entries).toHaveLength(LONGTAIL_ENTRIES_PER_TICKER);

        const urls = entries.map(e => e.url);
        expect(urls).toEqual([
            'https://siglens.io/AAPL',
            'https://siglens.io/AAPL/news',
            'https://siglens.io/AAPL/fundamental',
            'https://siglens.io/AAPL/overall',
            'https://siglens.io/AAPL/fear-greed',
        ]);
    });

    it('여러 티커에 대해 올바른 총 엔트리 수를 반환한다', () => {
        const entries = buildLongTailEntries(
            ['AAPL', 'MSFT', 'GOOG'],
            BUILD_DATE
        );
        expect(entries).toHaveLength(LONGTAIL_ENTRIES_PER_TICKER * 3);
    });

    it('빈 배열 → 빈 배열을 반환한다', () => {
        const entries = buildLongTailEntries([], BUILD_DATE);
        expect(entries).toHaveLength(0);
    });

    it('chart는 priority 0.5 / weekly, 서브 라우트는 설계대로 priority와 changefreq를 설정한다', () => {
        const entries = buildLongTailEntries(['AAPL'], BUILD_DATE);

        const chart = entries.find(e => e.url.endsWith('/AAPL'))!;
        expect(chart.priority).toBe(LONGTAIL_CHART_PRIORITY);
        expect(chart.changeFrequency).toBe('weekly');

        const news = entries.find(e => e.url.endsWith('/news'))!;
        expect(news.priority).toBe(LONGTAIL_SUB_PRIORITY);
        expect(news.changeFrequency).toBe('weekly');

        const fundamental = entries.find(e => e.url.endsWith('/fundamental'))!;
        expect(fundamental.priority).toBe(LONGTAIL_LOW_PRIORITY);
        expect(fundamental.changeFrequency).toBe('monthly');

        const overall = entries.find(e => e.url.endsWith('/overall'))!;
        expect(overall.priority).toBe(LONGTAIL_SUB_PRIORITY);
        expect(overall.changeFrequency).toBe('weekly');

        const fearGreed = entries.find(e => e.url.endsWith('/fear-greed'))!;
        expect(fearGreed.priority).toBe(LONGTAIL_LOW_PRIORITY);
        expect(fearGreed.changeFrequency).toBe('weekly');
    });

    it('모든 엔트리의 lastModified는 전달받은 buildDate와 같다', () => {
        const entries = buildLongTailEntries(['AAPL'], BUILD_DATE);
        for (const entry of entries) {
            expect(entry.lastModified).toBe(BUILD_DATE);
        }
    });
});
