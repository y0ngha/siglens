import type { MockedFunction } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { MarketNewsCardItem } from '@/entities/market-news';
import { getMarketNewsCardsAction } from '@/entities/market-news/actions';
import {
    POLL_INTERVAL_MS,
    MAX_CONSECUTIVE_FAILURES,
    EMPTY_SNAPSHOT_MAX_POLLS,
} from '@/widgets/market-news/constants';
import { useMarketNewsCardPolling } from '@/widgets/market-news/hooks/useMarketNewsCardPolling';

vi.mock('@/entities/market-news/actions', () => ({
    getMarketNewsCardsAction: vi.fn(),
    ensureMarketNewsCardsAnalyzedAction: vi.fn(),
    submitMarketNewsDigestAction: vi.fn(),
    pollMarketNewsDigestAction: vi.fn(),
    cancelMarketNewsDigestAction: vi.fn(),
}));

const mockGetMarketNewsCardsAction = getMarketNewsCardsAction as MockedFunction<
    typeof getMarketNewsCardsAction
>;

const ENRICHED_ITEM: MarketNewsCardItem = {
    id: 'mn-1',
    publishedAt: '2026-06-15T10:00:00.000Z',
    titleEn: 'BTC hits record',
    titleKo: 'BTC 신고가',
    sentiment: 'bullish',
    category: 'macro',
    bodyKo: 'BTC가 신고가를 기록했습니다.',
    summaryKo: 'BTC 강세.',
    priceImpact: 'high',
    url: 'https://example.com/btc',
    source: 'CoinWire',
    tickers: ['BTCUSD'],
};

const PENDING_ITEM: MarketNewsCardItem = {
    ...ENRICHED_ITEM,
    id: 'mn-pending',
    sentiment: null,
    priceImpact: null,
    category: null,
    bodyKo: null,
    summaryKo: null,
};

/** Advance fake timers one poll interval at a time, flushing React commits via `act`. */
async function advancePolls(count: number) {
    for (let i = 0; i < count; i++) {
        await act(async () => {
            await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
        });
    }
}

describe('useMarketNewsCardPolling', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        mockGetMarketNewsCardsAction.mockReset();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('(a) 모든 카드가 enriched 상태가 되면 폴링을 멈춘다', async () => {
        // First poll returns pending, second returns enriched.
        mockGetMarketNewsCardsAction
            .mockResolvedValueOnce({ ok: true, items: [PENDING_ITEM] })
            .mockResolvedValue({ ok: true, items: [ENRICHED_ITEM] });

        const { result } = renderHook(() =>
            useMarketNewsCardPolling('crypto', [PENDING_ITEM])
        );

        expect(result.current.isPolling).toBe(true);
        expect(result.current.items).toEqual([PENDING_ITEM]);

        // First poll — still pending
        await advancePolls(1);
        expect(result.current.items).toEqual([PENDING_ITEM]);
        expect(result.current.isPolling).toBe(true);

        // Second poll — all enriched → stops
        await advancePolls(1);
        expect(result.current.items).toEqual([ENRICHED_ITEM]);
        expect(result.current.isPolling).toBe(false);
        expect(result.current.pollError).toBeNull();
    });

    it('(b) 연속 실패 3회 후 폴링을 멈추고 pollError를 노출한다', async () => {
        mockGetMarketNewsCardsAction.mockResolvedValue({
            ok: false,
            error: 'db unavailable',
        });
        const errorSpy = vi
            .spyOn(console, 'error')
            .mockImplementation(() => {});

        const { result } = renderHook(() =>
            useMarketNewsCardPolling('stock', [ENRICHED_ITEM])
        );

        await advancePolls(MAX_CONSECUTIVE_FAILURES);

        expect(result.current.isPolling).toBe(false);
        expect(result.current.pollError).toBeInstanceOf(Error);
        expect(result.current.pollError?.message).toBe('db unavailable');
        expect(mockGetMarketNewsCardsAction).toHaveBeenCalledTimes(
            MAX_CONSECUTIVE_FAILURES
        );

        // Polling should not continue after failure cutoff.
        await advancePolls(5);
        expect(mockGetMarketNewsCardsAction).toHaveBeenCalledTimes(
            MAX_CONSECUTIVE_FAILURES
        );

        errorSpy.mockRestore();
    });

    it('빈 스냅샷 연속 20회 후 폴링을 멈춘다', async () => {
        mockGetMarketNewsCardsAction.mockResolvedValue({ ok: true, items: [] });

        const { result } = renderHook(() =>
            useMarketNewsCardPolling('general', [])
        );

        await advancePolls(EMPTY_SNAPSHOT_MAX_POLLS);

        expect(result.current.items).toEqual([]);
        expect(result.current.isPolling).toBe(false);
        expect(mockGetMarketNewsCardsAction).toHaveBeenCalledTimes(
            EMPTY_SNAPSHOT_MAX_POLLS
        );
    });

    it('카테고리 변경 시 상태를 초기화하고 새 카테고리로 폴링한다', async () => {
        mockGetMarketNewsCardsAction.mockResolvedValue({
            ok: true,
            items: [ENRICHED_ITEM],
        });

        type Props = { category: 'crypto' | 'stock' };
        const { result, rerender } = renderHook(
            ({ category }: Props) => useMarketNewsCardPolling(category, []),
            { initialProps: { category: 'crypto' } as Props }
        );

        await advancePolls(1);
        expect(mockGetMarketNewsCardsAction).toHaveBeenCalledWith('crypto');

        rerender({ category: 'stock' });

        expect(result.current.isPolling).toBe(true);
        expect(result.current.pollError).toBeNull();
    });
});
