import { describe, expect, it, vi } from 'vitest';
import { DrizzleMarketNewsRepository } from '../api';
import type { MarketNewsItem } from '../lib/marketNewsClientPort';

vi.mock('@/shared/lib/sleep', () => ({ sleep: vi.fn() }));

const ITEM: MarketNewsItem = {
    id: 'm1',
    symbol: '__NEWS_CRYPTO__',
    source: 'CoinWire',
    url: 'https://x.com/btc',
    publishedAt: '2026-06-15T10:00:00.000Z',
    titleEn: 'BTC up',
    bodyEn: 'body',
    tickers: ['BTCUSD'],
};

function makeUpsertDb(returned: { id: string }[]) {
    const chain = {
        values: vi.fn().mockReturnThis(),
        onConflictDoUpdate: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue(returned),
    };
    return {
        insert: vi.fn(() => chain),
    } as unknown as import('@/shared/db/types').SiglensDatabase;
}

describe('DrizzleMarketNewsRepository.upsertMarketNewsItem은', () => {
    it('row가 삽입/변경되면 true를 반환한다', async () => {
        const repo = new DrizzleMarketNewsRepository(
            makeUpsertDb([{ id: 'm1' }])
        );
        expect(await repo.upsertMarketNewsItem(ITEM)).toBe(true);
    });

    it('변경이 없으면 false를 반환한다(revalidate skip)', async () => {
        const repo = new DrizzleMarketNewsRepository(makeUpsertDb([]));
        expect(await repo.upsertMarketNewsItem(ITEM)).toBe(false);
    });
});
