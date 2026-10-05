import { describe, it, expect } from 'vitest';
import { buildCryptoPopularEntries } from '../lib/buildCryptoPopularEntries';
import { floorToHour } from '../lib/floorToHour';
import { POPULAR_CRYPTOS } from '@/shared/config/popular-cryptos';
import { MS_PER_HOUR } from '@/shared/config/time';

describe('buildCryptoPopularEntries', () => {
    const now = new Date('2026-06-21T10:00:00Z');

    it('emits chart + news + fear-greed per crypto (no stock-only routes, no noindex overall/position)', () => {
        const entries = buildCryptoPopularEntries(now);
        const btc = entries.filter(e => e.url.includes('/BTCUSD'));
        const paths = btc.map(e => e.url.replace('https://siglens.io', ''));
        // Pin the exact count: 3 routes per coin. `/overall` and `/position` are
        // always noindex (2026-10-01 SEO audit / 2026-09-11 recovery audit);
        // `/fear-greed` is indexable since 2026-10-01.
        // Adding a new indexable crypto tab without updating buildCryptoPopularEntries
        // will fail here.
        expect(btc).toHaveLength(3);
        expect(paths).toContain('/BTCUSD');
        expect(paths).toContain('/BTCUSD/news');
        expect(paths).toContain('/BTCUSD/fear-greed');
        expect(paths).not.toContain('/BTCUSD/overall');
        expect(paths).not.toContain('/BTCUSD/position');
        expect(paths).not.toContain('/BTCUSD/fundamental');
        expect(paths).not.toContain('/BTCUSD/options');
        expect(paths).not.toContain('/BTCUSD/congress');
    });

    // 차트·뉴스 탭은 렌더 가능한 산문 스냅샷이 없으면 noindex다 — 주식 sitemap과 같은 게이트.
    it('with a prose set, emits /news and the chart only for cryptos that have prose', () => {
        const entries = buildCryptoPopularEntries(now, {
            snapshotGeneratedAt: new Map([
                ['BTCUSD:news', new Date('2026-06-21T03:00:00Z')],
                ['BTCUSD:technical', new Date('2026-06-21T03:00:00Z')],
                ['ETHUSD:technical', new Date('2026-06-21T03:00:00Z')],
            ]),
        });
        const urls = entries.map(e => e.url);
        // 집합에 든 조합은 실제로 실린다 — 키 형식이 어긋나면 이 단언이 깨진다.
        expect(urls).toContain('https://siglens.io/BTCUSD/news');
        expect(urls).toContain('https://siglens.io/BTCUSD');
        expect(urls).toContain('https://siglens.io/ETHUSD');
        expect(urls).toContain('https://siglens.io/ETHUSD/fear-greed');
        expect(urls).not.toContain('https://siglens.io/ETHUSD/news');
        // technical 산문이 없는 코인은 차트 탭도 빠진다(페이지 no-prose).
        expect(urls).not.toContain('https://siglens.io/SOLUSD');
        expect(urls).toContain('https://siglens.io/SOLUSD/fear-greed');
    });

    it('emits exactly POPULAR_CRYPTOS.length × 3 total entries', () => {
        const entries = buildCryptoPopularEntries(now);
        expect(entries).toHaveLength(POPULAR_CRYPTOS.length * 3);
    });

    it('chart route uses the 6h-boundary lastmod (not rolling)', () => {
        const entries = buildCryptoPopularEntries(now);
        // now = 10:00 UTC → boundary = 06:00 UTC same day.
        const expected6hBoundary = new Date(
            '2026-06-21T06:00:00Z'
        ).toISOString();
        const chartEntry = entries.find(
            e => e.url === 'https://siglens.io/BTCUSD'
        );
        expect(chartEntry?.lastModified?.toISOString()).toBe(
            expected6hBoundary
        );
    });

    it('news route uses rolling 1h-ago lastmod, floored to the hour (most dynamic tab)', () => {
        const entries = buildCryptoPopularEntries(now);
        const newsEntry = entries.find(
            e => e.url === 'https://siglens.io/BTCUSD/news'
        );
        const expected = floorToHour(
            new Date(now.getTime() - MS_PER_HOUR)
        ).toISOString();
        expect(newsEntry?.lastModified?.toISOString()).toBe(expected);
    });

    /**
     * 회귀 가드(SEO 감사 finding 5): raw `now - 1h`였을 때는 같은 시간대 안에서도
     * 호출마다 값이 달라져 sitemap index lastmod의 freshness 신호가 무력화됐다.
     * `floorToHour` 적용 후로는 같은 시간대 안의 서로 다른 호출 시각이 동일한
     * lastmod를 내야 한다.
     */
    it('같은 시간대 안에서는 호출 시각이 달라도 news lastmod가 동일하다', () => {
        const a = buildCryptoPopularEntries(new Date('2026-06-21T10:00:05Z'));
        const b = buildCryptoPopularEntries(new Date('2026-06-21T10:59:55Z'));
        const newsOf = (es: ReturnType<typeof buildCryptoPopularEntries>) =>
            es
                .find(e => e.url === 'https://siglens.io/BTCUSD/news')!
                .lastModified?.getTime();
        expect(newsOf(a)).toBe(newsOf(b));
    });

    it('chart, news and fear-greed use daily changeFrequency', () => {
        const entries = buildCryptoPopularEntries(now);
        const chartEntry = entries.find(
            e => e.url === 'https://siglens.io/BTCUSD'
        );
        const newsEntry = entries.find(
            e => e.url === 'https://siglens.io/BTCUSD/news'
        );
        const fearGreedEntry = entries.find(
            e => e.url === 'https://siglens.io/BTCUSD/fear-greed'
        );
        expect(chartEntry?.changeFrequency).toBe('daily');
        expect(newsEntry?.changeFrequency).toBe('daily');
        expect(fearGreedEntry?.changeFrequency).toBe('daily');
    });

    it('fear-greed route uses the UTC-midnight lastmod of now', () => {
        const entries = buildCryptoPopularEntries(now);
        const fearGreedEntry = entries.find(
            e => e.url === 'https://siglens.io/BTCUSD/fear-greed'
        );
        expect(fearGreedEntry?.lastModified?.toISOString()).toBe(
            '2026-06-21T00:00:00.000Z'
        );
        expect(fearGreedEntry?.priority).toBe(0.75);
    });

    it('6h boundary quantizes correctly: midnight → 00:00', () => {
        const midnight = new Date('2026-06-21T00:30:00Z');
        const entries = buildCryptoPopularEntries(midnight);
        const expected = new Date('2026-06-21T00:00:00Z').toISOString();
        const chartEntry = entries.find(
            e => e.url === 'https://siglens.io/BTCUSD'
        );
        expect(chartEntry?.lastModified?.toISOString()).toBe(expected);
    });

    it('6h boundary quantizes correctly: 17:59 → 12:00', () => {
        const late = new Date('2026-06-21T17:59:00Z');
        const entries = buildCryptoPopularEntries(late);
        const expected = new Date('2026-06-21T12:00:00Z').toISOString();
        const chartEntry = entries.find(
            e => e.url === 'https://siglens.io/BTCUSD'
        );
        expect(chartEntry?.lastModified?.toISOString()).toBe(expected);
    });

    it('covers every POPULAR_CRYPTOS symbol', () => {
        const entries = buildCryptoPopularEntries(now);
        for (const sym of POPULAR_CRYPTOS) {
            expect(entries.some(e => e.url.endsWith(`/${sym}`))).toBe(true);
        }
    });

    // 2차 lastmod 정직화(2026-10-04): 스냅샷이 실제로 구워진 시각을 광고한다.
    describe('스냅샷 generatedAt lastmod', () => {
        const entryOf = (
            entries: ReturnType<typeof buildCryptoPopularEntries>,
            url: string
        ) => entries.find(e => e.url === url);

        it('news route uses the news snapshot generatedAt, not now − 1h', () => {
            const generatedAt = new Date('2026-06-20T22:15:00Z');
            const entries = buildCryptoPopularEntries(now, {
                snapshotGeneratedAt: new Map([['BTCUSD:news', generatedAt]]),
            });

            expect(
                entryOf(
                    entries,
                    'https://siglens.io/BTCUSD/news'
                )?.lastModified?.toISOString()
            ).toBe(generatedAt.toISOString());
        });

        it('chart route uses the later of the 6h boundary and the technical snapshot', () => {
            // now 10:00Z → boundary 06:00Z. 스냅샷이 08:45Z에 구워졌다.
            const technicalAt = new Date('2026-06-21T08:45:00Z');
            const entries = buildCryptoPopularEntries(now, {
                snapshotGeneratedAt: new Map([
                    ['BTCUSD:technical', technicalAt],
                ]),
            });

            expect(
                entryOf(
                    entries,
                    'https://siglens.io/BTCUSD'
                )?.lastModified?.toISOString()
            ).toBe(technicalAt.toISOString());
        });

        it('chart route keeps the 6h boundary when the technical snapshot is older', () => {
            const entries = buildCryptoPopularEntries(now, {
                snapshotGeneratedAt: new Map([
                    ['BTCUSD:technical', new Date('2026-06-21T01:00:00Z')],
                ]),
            });

            expect(
                entryOf(
                    entries,
                    'https://siglens.io/BTCUSD'
                )?.lastModified?.toISOString()
            ).toBe('2026-06-21T06:00:00.000Z');
        });

        it('chart route is omitted for a coin without renderable technical prose', () => {
            const entries = buildCryptoPopularEntries(now, {
                snapshotGeneratedAt: new Map([
                    ['ETHUSD:technical', new Date('2026-06-21T08:45:00Z')],
                ]),
            });

            expect(
                entryOf(entries, 'https://siglens.io/BTCUSD')
            ).toBeUndefined();
            expect(
                entryOf(
                    entries,
                    'https://siglens.io/ETHUSD'
                )?.lastModified?.toISOString()
            ).toBe('2026-06-21T08:45:00.000Z');
        });

        it('fear-greed stays at UTC midnight regardless of snapshots', () => {
            const entries = buildCryptoPopularEntries(now, {
                snapshotGeneratedAt: new Map([
                    ['BTCUSD:technical', new Date('2026-06-21T08:45:00Z')],
                    ['BTCUSD:news', new Date('2026-06-21T09:00:00Z')],
                ]),
            });

            expect(
                entryOf(
                    entries,
                    'https://siglens.io/BTCUSD/fear-greed'
                )?.lastModified?.toISOString()
            ).toBe('2026-06-21T00:00:00.000Z');
        });
    });
});
