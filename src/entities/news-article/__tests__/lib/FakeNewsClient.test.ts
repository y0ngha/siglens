import { describe, it, expect } from 'vitest';
import { FakeNewsClient } from '../../lib/FakeNewsClient';

describe('FakeNewsClient', () => {
    const client = new FakeNewsClient();

    it('fetchNews returns fixture news items stamped with the requested symbol', async () => {
        const items = await client.fetchNews('aapl', '7d');

        expect(items.length).toBeGreaterThan(0);
        expect(items.every(i => i.symbol === 'AAPL')).toBe(true);
        const [first] = items;
        expect(first).toMatchObject({
            id: expect.any(String),
            source: expect.any(String),
            url: expect.any(String),
            publishedAt: expect.any(String),
            titleEn: expect.any(String),
        });
    });

    it('fetchNewsForPeriod returns fixture news items stamped with the requested symbol', async () => {
        const items = await client.fetchNewsForPeriod('tsla', 86_400_000);

        expect(items.length).toBeGreaterThan(0);
        expect(items.every(i => i.symbol === 'TSLA')).toBe(true);
    });
});
