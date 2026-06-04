import { describe, it, expect, vi, beforeEach } from 'vitest';
import type {
    MarketBriefingResponse,
    MarketSummaryData,
} from '@y0ngha/siglens-core';
import { SECONDS_PER_HOUR } from '@/shared/config/time';

vi.mock('next/cache', () => ({
    unstable_cache: (
        fn: (
            summary: MarketSummaryData
        ) => Promise<MarketBriefingResponse | null>,
        _keys: unknown,
        opts: unknown
    ) => {
        (globalThis as Record<string, unknown>).__lastUnstableCacheOpts = opts;
        return fn;
    },
}));

const { mockPeekBriefingCache } = vi.hoisted(() => ({
    mockPeekBriefingCache: vi.fn(),
}));

vi.mock('@y0ngha/siglens-core', async () => ({
    ...(await vi.importActual('@y0ngha/siglens-core')),
    peekBriefingCache: mockPeekBriefingCache,
}));

import { peekBriefingStatic } from '../lib/briefingStaticCache';

const sampleSummary: MarketSummaryData = {
    indices: [],
    sectors: [],
};

const sampleBriefing = {
    briefing: {
        overallSentiment: 'bullish',
        summary: 'Markets are looking positive',
        sectors: [],
        volatility: { level: 'low', vixLevel: 15, interpretation: 'calm' },
    },
} as unknown as MarketBriefingResponse;

describe('peekBriefingStatic', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        delete (globalThis as Record<string, unknown>).__lastUnstableCacheOpts;
    });

    it('(Happy) peekBriefingCache를 summary와 함께 호출하고 결과를 반환한다', async () => {
        mockPeekBriefingCache.mockResolvedValue(sampleBriefing);

        const result = await peekBriefingStatic(sampleSummary, '2026-06-04T10');

        expect(result).toBe(sampleBriefing);
        expect(mockPeekBriefingCache).toHaveBeenCalledWith(sampleSummary);
    });

    it('(Happy) unstable_cache opts: revalidate=3600, tags=[market-summary]', async () => {
        mockPeekBriefingCache.mockResolvedValue(sampleBriefing);

        await peekBriefingStatic(sampleSummary, '2026-06-04T10');

        expect(
            (globalThis as Record<string, unknown>).__lastUnstableCacheOpts
        ).toEqual({
            revalidate: SECONDS_PER_HOUR,
            tags: ['market-summary'],
        });
    });

    it('(Worst) briefing 미존재(캐시 miss) 시 null을 그대로 반환한다', async () => {
        mockPeekBriefingCache.mockResolvedValue(null);

        const result = await peekBriefingStatic(sampleSummary, '2026-06-04T10');

        expect(result).toBeNull();
    });

    it('(Worst) peekBriefingCache가 throw하면 에러가 전파된다', async () => {
        mockPeekBriefingCache.mockRejectedValue(new Error('redis error'));

        await expect(
            peekBriefingStatic(sampleSummary, '2026-06-04T10')
        ).rejects.toThrow('redis error');
    });

    it('(Happy) 서로 다른 dateHour는 독립적으로 호출된다', async () => {
        mockPeekBriefingCache.mockResolvedValue(sampleBriefing);

        await peekBriefingStatic(sampleSummary, '2026-06-04T10');
        await peekBriefingStatic(sampleSummary, '2026-06-04T11');

        expect(mockPeekBriefingCache).toHaveBeenCalledTimes(2);
    });
});
