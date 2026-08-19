import { describe, it, expect, vi, beforeEach } from 'vitest';
import type {
    MarketBriefingResponse,
    MarketSummaryData,
} from '@y0ngha/siglens-core';
import { SECONDS_PER_HOUR } from '@/shared/config/time';
import {
    KR_DASHBOARD_SCOPE,
    US_DASHBOARD_SCOPE,
} from '@/shared/config/dashboardScope';

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

import { peekBriefingStatic } from '../api/briefingStaticCache';

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

        const result = await peekBriefingStatic(
            sampleSummary,
            '2026-06-04T10',
            US_DASHBOARD_SCOPE
        );

        expect(result).toBe(sampleBriefing);
        expect(mockPeekBriefingCache).toHaveBeenCalledWith(sampleSummary, {
            marketLabel: '미국 증시',
            // 요약에 VIX 시세가 없으므로 변동성은 없는 것으로 넘어간다 —
            // 프롬프트에 없는 숫자를 요구하지 않기 위해서다.
            volatility: null,
        });
    });

    /**
     * context는 core `hashBriefingInput`에 접혀 들어간다. 쓰기 경로와 다르게
     * 조립되면 peek이 아무도 쓴 적 없는 키를 읽어 **영원히 미스**한다 — 화면은
     * 정상이고 로그도 조용해서 LLM 호출량으로만 드러난다.
     */
    it('(Happy) 시장마다 다른 context를 넘긴다', async () => {
        mockPeekBriefingCache.mockResolvedValue(null);

        await peekBriefingStatic(
            { indices: [], sectors: [] },
            '2026-06-04T10',
            KR_DASHBOARD_SCOPE
        );

        expect(mockPeekBriefingCache).toHaveBeenCalledWith(expect.anything(), {
            marketLabel: '한국 증시',
            volatility: null,
        });
    });

    it('(Happy) 요약에 변동성 지수 시세가 있으면 값으로 실어 보낸다', async () => {
        mockPeekBriefingCache.mockResolvedValue(null);

        await peekBriefingStatic(
            {
                indices: [
                    {
                        symbol: 'VIX',
                        fmpSymbol: '^VIX',
                        displayName: 'VIX',
                        koreanName: '공포지수',
                        price: 18.3,
                        changesPercentage: -2.1,
                    },
                ],
                sectors: [],
            },
            '2026-06-04T10',
            US_DASHBOARD_SCOPE
        );

        expect(mockPeekBriefingCache).toHaveBeenCalledWith(expect.anything(), {
            marketLabel: '미국 증시',
            volatility: { label: 'VIX', level: 18.3 },
        });
    });

    it('(Happy) unstable_cache opts: revalidate=3600, tags=[market:briefing:us]', async () => {
        mockPeekBriefingCache.mockResolvedValue(sampleBriefing);

        await peekBriefingStatic(
            sampleSummary,
            '2026-06-04T10',
            US_DASHBOARD_SCOPE
        );

        expect(
            (globalThis as Record<string, unknown>).__lastUnstableCacheOpts
        ).toEqual({
            revalidate: SECONDS_PER_HOUR,
            tags: ['market:briefing:us'],
        });
    });

    it('(Worst) briefing 미존재(캐시 miss) 시 null을 그대로 반환한다', async () => {
        mockPeekBriefingCache.mockResolvedValue(null);

        const result = await peekBriefingStatic(
            sampleSummary,
            '2026-06-04T10',
            US_DASHBOARD_SCOPE
        );

        expect(result).toBeNull();
    });

    it('(Worst) peekBriefingCache가 throw하면 에러가 전파된다', async () => {
        mockPeekBriefingCache.mockRejectedValue(new Error('redis error'));

        await expect(
            peekBriefingStatic(
                sampleSummary,
                '2026-06-04T10',
                US_DASHBOARD_SCOPE
            )
        ).rejects.toThrow('redis error');
    });

    it('(Happy) 서로 다른 dateHour는 독립적으로 호출된다', async () => {
        mockPeekBriefingCache.mockResolvedValue(sampleBriefing);

        await peekBriefingStatic(
            sampleSummary,
            '2026-06-04T10',
            US_DASHBOARD_SCOPE
        );
        await peekBriefingStatic(
            sampleSummary,
            '2026-06-04T11',
            US_DASHBOARD_SCOPE
        );

        expect(mockPeekBriefingCache).toHaveBeenCalledTimes(2);
    });
});
