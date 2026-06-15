vi.mock('@/shared/lib/seo', () => ({
    SITE_URL: 'https://siglens.io',
}));

import {
    buildLongTailEntries,
    LONGTAIL_CHART_PRIORITY,
} from '../lib/buildLongTailEntries';
import { LONGTAIL_ENTRIES_PER_TICKER } from '../model';

const BUILD_DATE = new Date('2026-01-15T00:00:00.000Z');

describe('buildLongTailEntries', () => {
    it('LONGTAIL_ENTRIES_PER_TICKER는 1로 고정된다 — 서브 라우트 미광고(비용 절감) 결정 핀', () => {
        // 다른 테스트는 상수를 symbolic하게 쓰므로, 값이 5로 되돌아가도 조용히 따라간다.
        // 이 핀이 그 회귀를 즉시 실패시킨다.
        expect(LONGTAIL_ENTRIES_PER_TICKER).toBe(1);
    });

    it('티커 1개 → 메인 차트 1개 엔트리만 반환한다(서브 라우트 미광고)', () => {
        const entries = buildLongTailEntries(['AAPL'], BUILD_DATE);
        expect(entries).toHaveLength(LONGTAIL_ENTRIES_PER_TICKER);
        expect(entries.map(e => e.url)).toEqual(['https://siglens.io/AAPL']);
    });

    it('여러 티커 → 티커당 1개씩 총 N개를 반환한다', () => {
        const entries = buildLongTailEntries(
            ['AAPL', 'MSFT', 'GOOG'],
            BUILD_DATE
        );
        expect(entries).toHaveLength(LONGTAIL_ENTRIES_PER_TICKER * 3);
        expect(entries.map(e => e.url)).toEqual([
            'https://siglens.io/AAPL',
            'https://siglens.io/MSFT',
            'https://siglens.io/GOOG',
        ]);
    });

    it('빈 배열 → 빈 배열을 반환한다', () => {
        const entries = buildLongTailEntries([], BUILD_DATE);
        expect(entries).toHaveLength(0);
    });

    it('메인 차트 엔트리는 priority 0.5 / weekly다', () => {
        const [chart] = buildLongTailEntries(['AAPL'], BUILD_DATE);
        expect(chart.url).toBe('https://siglens.io/AAPL');
        expect(chart.priority).toBe(LONGTAIL_CHART_PRIORITY);
        expect(chart.changeFrequency).toBe('weekly');
    });

    it('모든 엔트리의 lastModified는 전달받은 buildDate와 같다', () => {
        const entries = buildLongTailEntries(['AAPL'], BUILD_DATE);
        for (const entry of entries) {
            expect(entry.lastModified).toBe(BUILD_DATE);
        }
    });
});
