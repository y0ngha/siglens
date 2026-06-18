/**
 * Tests for useWaitForMarketNewsCards hook.
 *
 * Uses vitest fake timers to control setInterval without real I/O.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { MockedFunction } from 'vitest';
import type { NewsFeedCategory } from '@y0ngha/siglens-core';
import type { MarketNewsCardItem } from '@/entities/market-news';
import { getMarketNewsCardsAction } from '@/entities/market-news/actions';
import { useWaitForMarketNewsCards } from '../hooks/useWaitForMarketNewsCards';

vi.mock('@/entities/market-news/actions', () => ({
    getMarketNewsCardsAction: vi.fn(),
    ensureMarketNewsCardsAnalyzedAction: vi.fn(),
    submitMarketNewsDigestAction: vi.fn(),
    pollMarketNewsDigestAction: vi.fn(),
    cancelMarketNewsDigestAction: vi.fn(),
}));

const mockGetCards = getMarketNewsCardsAction as MockedFunction<
    typeof getMarketNewsCardsAction
>;

const ENRICHED_ITEM: MarketNewsCardItem = {
    id: 'mn-1',
    publishedAt: '2026-06-15T10:00:00.000Z',
    titleEn: 'BTC up',
    titleKo: '비트코인 상승',
    sentiment: 'bullish',
    category: 'macro',
    bodyKo: null,
    summaryKo: '요약',
    priceImpact: 'high',
    url: 'https://example.com',
    source: 'Reuters',
    tickers: [],
};

describe('useWaitForMarketNewsCards', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        mockGetCards.mockReset();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('initiallyReady=true이면 isReady=true를 즉시 반환하고 polling을 하지 않는다', () => {
        const { result } = renderHook(() =>
            useWaitForMarketNewsCards('general', true)
        );

        expect(result.current.isReady).toBe(true);
        expect(result.current.waitError).toBeNull();
        expect(mockGetCards).not.toHaveBeenCalled();
    });

    it('initiallyReady=false이면 polling을 시작하고 enriched 아이템 감지 시 isReady=true가 된다', async () => {
        mockGetCards.mockResolvedValue({ ok: true, items: [ENRICHED_ITEM] });

        const { result } = renderHook(() =>
            useWaitForMarketNewsCards('crypto', false)
        );

        // Initially not ready
        expect(result.current.isReady).toBe(false);

        // Advance past the poll interval
        await act(async () => {
            vi.advanceTimersByTime(4000);
            await Promise.resolve();
        });

        expect(result.current.isReady).toBe(true);
        expect(mockGetCards).toHaveBeenCalled();
    });

    it('unmount 시 interval이 정리된다 (cleanup on unmount)', () => {
        mockGetCards.mockResolvedValue({ ok: true, items: [] });

        const clearIntervalSpy = vi.spyOn(global, 'clearInterval');

        const { unmount } = renderHook(() =>
            useWaitForMarketNewsCards('general', false)
        );

        unmount();

        expect(clearIntervalSpy).toHaveBeenCalled();
        clearIntervalSpy.mockRestore();
    });

    it('category가 바뀌면 isReady를 리셋하고 새 카테고리로 polling을 시작한다', async () => {
        mockGetCards.mockResolvedValue({ ok: true, items: [ENRICHED_ITEM] });

        const { result, rerender } = renderHook(
            ({
                category,
                initiallyReady,
            }: {
                category: NewsFeedCategory;
                initiallyReady: boolean;
            }) => useWaitForMarketNewsCards(category, initiallyReady),
            {
                initialProps: {
                    category: 'crypto' as NewsFeedCategory,
                    initiallyReady: true,
                },
            }
        );

        expect(result.current.isReady).toBe(true);

        // Switch category with initiallyReady=false — polling restarts for 'general'
        rerender({ category: 'general' as const, initiallyReady: false });

        expect(result.current.isReady).toBe(false);

        // Advance timers so the new poll interval fires
        await act(async () => {
            vi.advanceTimersByTime(4000);
            await Promise.resolve();
        });

        // getMarketNewsCardsAction should now be called with the new category
        expect(mockGetCards).toHaveBeenCalledWith('general');
        expect(result.current.isReady).toBe(true);
    });
});
