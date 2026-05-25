// @vitest-environment jsdom
import { renderHook, waitFor } from '@testing-library/react';
import { useWaitForNewsCards } from '@/widgets/news/hooks/useWaitForNewsCards';
import { getNewsCardsAction } from '@/entities/news-article/actions';
import type { NewsDisplayItem } from '@/shared/lib/types';

vi.mock('@/entities/news-article/actions', () => ({
    getNewsCardsAction: vi.fn(),
}));

vi.mock('@/widgets/news/constants', () => ({
    POLL_INTERVAL_MS: 50,
    MAX_CONSECUTIVE_FAILURES: 2,
}));

const mockGetCards = getNewsCardsAction as ReturnType<typeof vi.fn>;

const ENRICHED_ITEM = {
    id: '1',
    title: 'News 1',
    sentiment: 'bullish',
    priceImpact: 'high',
} as unknown as NewsDisplayItem;

const PENDING_ITEM = {
    id: '2',
    title: 'News 2',
    sentiment: null,
    priceImpact: null,
} as unknown as NewsDisplayItem;

describe('useWaitForNewsCards', () => {
    afterEach(() => {
        mockGetCards.mockReset();
        vi.restoreAllMocks();
    });

    it('returns isReady true immediately when initiallyReady is true', () => {
        const { result } = renderHook(() => useWaitForNewsCards('AAPL', true));
        expect(result.current.isReady).toBe(true);
        expect(result.current.pollError).toBeNull();
    });

    it('returns isReady false initially when initiallyReady is false', () => {
        mockGetCards.mockResolvedValue([PENDING_ITEM]);
        const { result } = renderHook(() => useWaitForNewsCards('AAPL', false));
        expect(result.current.isReady).toBe(false);
    });

    it('becomes ready when polling returns enriched cards', async () => {
        mockGetCards.mockResolvedValue([ENRICHED_ITEM]);
        const { result } = renderHook(() => useWaitForNewsCards('AAPL', false));

        await waitFor(() => {
            expect(result.current.isReady).toBe(true);
        });
    });

    it('does not call getNewsCardsAction when initiallyReady is true', () => {
        renderHook(() => useWaitForNewsCards('AAPL', true));
        expect(mockGetCards).not.toHaveBeenCalled();
    });

    it('sets pollError after consecutive failures', async () => {
        mockGetCards.mockRejectedValue(new Error('fetch failed'));
        const { result } = renderHook(() => useWaitForNewsCards('AAPL', false));

        await waitFor(() => {
            expect(result.current.pollError).not.toBeNull();
        });

        expect(result.current.pollError?.message).toBe('fetch failed');
    });
});
