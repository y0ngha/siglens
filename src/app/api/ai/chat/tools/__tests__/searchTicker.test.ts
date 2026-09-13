import { describe, expect, it, vi } from 'vitest';

const { search } = vi.hoisted(() => ({ search: vi.fn() }));
vi.mock('@/entities/ticker/lib/searchTicker', () => ({ searchTicker: search }));

import { searchTickerTool } from '@/app/api/ai/chat/tools/searchTicker';

const ctx = {
    userId: 'u',
    tier: 'member' as const,
    locale: 'ko' as const,
    signal: new AbortController().signal,
};
const rt = { analysisModel: 'deepseek-v4.1-flash' as const };

const result = (i: number) => ({
    symbol: `S${i}`,
    name: `Name ${i}`,
    exchange: 'NASDAQ',
});

describe('searchTickerTool', () => {
    it('8건으로 절단', async () => {
        search.mockResolvedValue(
            Array.from({ length: 12 }, (_, i) => result(i))
        );
        const r = (await searchTickerTool({ query: 'a' }, ctx, rt)) as {
            results: unknown[];
        };
        expect(r.results).toHaveLength(8);
        expect(search).toHaveBeenCalledWith('a');
    });

    it('koreanName·marketProfile은 없으면 null로 채운다', async () => {
        search.mockResolvedValue([result(1)]);
        const r = (await searchTickerTool({ query: 'a' }, ctx, rt)) as {
            results: Array<{
                koreanName: string | null;
                marketProfile: string | null;
            }>;
        };
        expect(r.results[0]).toMatchObject({
            koreanName: null,
            marketProfile: null,
        });
    });
});
