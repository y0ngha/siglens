import { describe, expect, it, vi } from 'vitest';

const { search } = vi.hoisted(() => ({ search: vi.fn() }));
vi.mock('@/entities/ticker/server/searchTicker', () => ({
    searchTicker: search,
}));

import { searchTickerTool } from '@/app/api/ai/chat/tools/searchTicker';

const ctx = {
    userId: 'u',
    tier: 'member' as const,
    locale: 'ko' as const,
    signal: new AbortController().signal,
};
const rt = {
    analysisModel: 'deepseek-v4.1-flash' as const,
    ensureSymbolData: async (): Promise<void> => {},
};

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

    it('0건이면 영문 원명으로 재검색하라는 hint를 붙인다', async () => {
        search.mockResolvedValue([]);
        const r = (await searchTickerTool({ query: '실SQ' }, ctx, rt)) as {
            hint?: string;
            results: unknown[];
        };
        expect(r.results).toEqual([]);
        expect(r.hint).toContain('search_ticker again');
    });

    it('결과가 있으면 hint를 붙이지 않는다', async () => {
        search.mockResolvedValue([result(1)]);
        const r = (await searchTickerTool({ query: 'a' }, ctx, rt)) as {
            hint?: string;
        };
        expect(r).not.toHaveProperty('hint');
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
