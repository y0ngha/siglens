import { describe, it, expect } from 'vitest';
import { buildCryptoPopularEntries } from '../lib/buildCryptoPopularEntries';
import { floorToHour } from '../lib/floorToHour';
import { POPULAR_CRYPTOS } from '@/shared/config/popular-cryptos';
import { MS_PER_HOUR } from '@/shared/config/time';

describe('buildCryptoPopularEntries', () => {
    const now = new Date('2026-06-21T10:00:00Z');

    it('emits chart + news + fear-greed + overall per crypto (no stock-only routes)', () => {
        const entries = buildCryptoPopularEntries(now);
        const btc = entries.filter(e => e.url.includes('/BTCUSD'));
        const paths = btc.map(e => e.url.replace('https://siglens.io', ''));
        // Pin the exact count: 4 routes per coin (root, /news, /fear-greed, /overall).
        // Adding a new crypto tab without updating buildCryptoPopularEntries will fail here.
        expect(btc).toHaveLength(4);
        expect(paths).toContain('/BTCUSD');
        expect(paths).toContain('/BTCUSD/news');
        expect(paths).toContain('/BTCUSD/fear-greed');
        expect(paths).toContain('/BTCUSD/overall');
        expect(paths).not.toContain('/BTCUSD/fundamental');
        expect(paths).not.toContain('/BTCUSD/options');
        expect(paths).not.toContain('/BTCUSD/congress');
    });

    it('emits exactly POPULAR_CRYPTOS.length × 4 total entries', () => {
        const entries = buildCryptoPopularEntries(now);
        expect(entries).toHaveLength(POPULAR_CRYPTOS.length * 4);
    });

    it('chart and fear-greed and overall routes use the 6h-boundary lastmod (not rolling)', () => {
        const entries = buildCryptoPopularEntries(now);
        // now = 10:00 UTC → boundary = 06:00 UTC same day.
        const expected6hBoundary = new Date(
            '2026-06-21T06:00:00Z'
        ).toISOString();
        const chartEntry = entries.find(
            e => e.url === 'https://siglens.io/BTCUSD'
        );
        const fgEntry = entries.find(
            e => e.url === 'https://siglens.io/BTCUSD/fear-greed'
        );
        const overallEntry = entries.find(
            e => e.url === 'https://siglens.io/BTCUSD/overall'
        );
        expect(chartEntry?.lastModified.toISOString()).toBe(expected6hBoundary);
        expect(fgEntry?.lastModified.toISOString()).toBe(expected6hBoundary);
        expect(overallEntry?.lastModified.toISOString()).toBe(
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
        expect(newsEntry?.lastModified.toISOString()).toBe(expected);
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
                .lastModified.getTime();
        expect(newsOf(a)).toBe(newsOf(b));
    });

    it('chart/fear-greed use daily changeFrequency; overall uses weekly', () => {
        const entries = buildCryptoPopularEntries(now);
        const chartEntry = entries.find(
            e => e.url === 'https://siglens.io/BTCUSD'
        );
        const newsEntry = entries.find(
            e => e.url === 'https://siglens.io/BTCUSD/news'
        );
        const fgEntry = entries.find(
            e => e.url === 'https://siglens.io/BTCUSD/fear-greed'
        );
        const overallEntry = entries.find(
            e => e.url === 'https://siglens.io/BTCUSD/overall'
        );
        expect(chartEntry?.changeFrequency).toBe('daily');
        expect(newsEntry?.changeFrequency).toBe('daily');
        expect(fgEntry?.changeFrequency).toBe('daily');
        expect(overallEntry?.changeFrequency).toBe('weekly');
    });

    it('6h boundary quantizes correctly: midnight → 00:00', () => {
        const midnight = new Date('2026-06-21T00:30:00Z');
        const entries = buildCryptoPopularEntries(midnight);
        const expected = new Date('2026-06-21T00:00:00Z').toISOString();
        const chartEntry = entries.find(
            e => e.url === 'https://siglens.io/BTCUSD'
        );
        expect(chartEntry?.lastModified.toISOString()).toBe(expected);
    });

    it('6h boundary quantizes correctly: 17:59 → 12:00', () => {
        const late = new Date('2026-06-21T17:59:00Z');
        const entries = buildCryptoPopularEntries(late);
        const expected = new Date('2026-06-21T12:00:00Z').toISOString();
        const chartEntry = entries.find(
            e => e.url === 'https://siglens.io/BTCUSD'
        );
        expect(chartEntry?.lastModified.toISOString()).toBe(expected);
    });

    it('covers every POPULAR_CRYPTOS symbol', () => {
        const entries = buildCryptoPopularEntries(now);
        for (const sym of POPULAR_CRYPTOS) {
            expect(entries.some(e => e.url.endsWith(`/${sym}`))).toBe(true);
        }
    });
});
