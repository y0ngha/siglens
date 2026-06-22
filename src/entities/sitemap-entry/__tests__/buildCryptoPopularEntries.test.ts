import { describe, it, expect } from 'vitest';
import { buildCryptoPopularEntries } from '../lib/buildCryptoPopularEntries';
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

    it('uses a rolling lastmod of exactly now minus one hour', () => {
        const entries = buildCryptoPopularEntries(now);
        const expectedLastmod = new Date(
            now.getTime() - MS_PER_HOUR
        ).toISOString();
        for (const e of entries) {
            expect(e.lastModified.toISOString()).toBe(expectedLastmod);
        }
    });

    it('covers every POPULAR_CRYPTOS symbol', () => {
        const entries = buildCryptoPopularEntries(now);
        for (const sym of POPULAR_CRYPTOS) {
            expect(entries.some(e => e.url.endsWith(`/${sym}`))).toBe(true);
        }
    });
});
