import { describe, it, expect, vi } from 'vitest';
import { DrizzleMarketNewsRepository } from '../api';

vi.mock('@/shared/lib/sleep', () => ({ sleep: vi.fn() }));

describe('market-news 격리', () => {
    it('upsert가 market_news 테이블만 대상으로 한다', async () => {
        const insert = vi.fn().mockReturnValue({
            values: vi.fn().mockReturnThis(),
            onConflictDoUpdate: vi.fn().mockReturnThis(),
            returning: vi.fn().mockResolvedValue([{ id: 'm1' }]),
        });
        const repo = new DrizzleMarketNewsRepository({
            insert,
        } as unknown as import('@/shared/db/types').SiglensDatabase);
        await repo.upsertMarketNewsItem({
            id: 'm1',
            symbol: '__NEWS_STOCK__',
            source: 's',
            url: 'https://x/1',
            publishedAt: '2026-06-15T10:00:00Z',
            titleEn: 't',
            bodyEn: null,
            tickers: ['AAPL'],
        });

        // The table object passed to insert must be the marketNews schema object, not news.
        const tableArg = insert.mock.calls[0]?.[0];
        expect(tableArg).toBeDefined();

        // Drizzle table objects carry their identity via reference — assert against the
        // imported marketNews table to prove category ingestion never touches the `news` table.
        const { marketNews } = await import('@/shared/db/schema');
        expect(insert).toHaveBeenCalledWith(marketNews);
    });
});
