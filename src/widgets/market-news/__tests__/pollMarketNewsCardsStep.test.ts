/**
 * Unit tests for pollMarketNewsCardsStep.
 *
 * Uses a hand-built PollMarketNewsCardsContext with vi.fn() setters and
 * controlled getter state to cover all branching paths without invoking real
 * server actions or React state.
 */

import type { MockedFunction } from 'vitest';
import type { MarketNewsCardItem } from '@/entities/market-news/actions';
import { getMarketNewsCardsAction } from '@/entities/market-news/actions';
import {
    MAX_CONSECUTIVE_FAILURES,
    EMPTY_SNAPSHOT_MAX_POLLS,
    MAX_POLL_DURATION_MS,
} from '@/widgets/market-news/constants';
import {
    pollMarketNewsCardsStep,
    type PollMarketNewsCardsContext,
} from '../utils/pollMarketNewsCardsStep';

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
    id: 'mn-enriched-1',
    publishedAt: '2026-06-15T10:00:00.000Z',
    titleEn: 'Fed holds rates',
    titleKo: '연준 금리 동결',
    sentiment: 'neutral',
    category: 'macro',
    bodyKo: '연준이 금리를 동결했습니다.',
    summaryKo: '연준 동결.',
    priceImpact: 'medium',
    url: 'https://example.com/fed',
    source: 'Reuters',
    tickers: ['SPY'],
};

const PENDING_ITEM: MarketNewsCardItem = {
    ...ENRICHED_ITEM,
    id: 'mn-pending-1',
    sentiment: null,
    priceImpact: null,
    category: null,
    bodyKo: null,
    summaryKo: null,
};

/**
 * Build a minimal PollMarketNewsCardsContext with all setters as vi.fn() and
 * getters returning controllable values from a mutable state object.
 */
function makeCtx(
    overrides: Partial<{
        startTime: number;
        pollCount: number;
        consecutiveFailures: number;
    }> = {}
): {
    ctx: PollMarketNewsCardsContext;
    state: { pollCount: number; consecutiveFailures: number };
    mocks: {
        incrementFailures: ReturnType<typeof vi.fn>;
        resetFailures: ReturnType<typeof vi.fn>;
        incrementPollCount: ReturnType<typeof vi.fn>;
        setItems: ReturnType<typeof vi.fn>;
        setIsPolling: ReturnType<typeof vi.fn>;
        setPollError: ReturnType<typeof vi.fn>;
        clearInterval: ReturnType<typeof vi.fn>;
    };
} {
    const startTime = overrides.startTime ?? Date.now();
    const state = {
        pollCount: overrides.pollCount ?? 0,
        consecutiveFailures: overrides.consecutiveFailures ?? 0,
    };

    const mocks = {
        incrementFailures: vi.fn(() => {
            state.consecutiveFailures += 1;
        }),
        resetFailures: vi.fn(() => {
            state.consecutiveFailures = 0;
        }),
        incrementPollCount: vi.fn(() => {
            state.pollCount += 1;
        }),
        setItems: vi.fn(),
        setIsPolling: vi.fn(),
        setPollError: vi.fn(),
        clearInterval: vi.fn(),
    };

    const ctx: PollMarketNewsCardsContext = {
        category: 'general',
        incrementFailures: mocks.incrementFailures,
        resetFailures: mocks.resetFailures,
        incrementPollCount: mocks.incrementPollCount,
        getStartTime: () => startTime,
        getPollCount: () => state.pollCount,
        getConsecutiveFailures: () => state.consecutiveFailures,
        setItems: mocks.setItems,
        setIsPolling: mocks.setIsPolling,
        setPollError: mocks.setPollError,
        clearInterval: mocks.clearInterval,
    };

    return { ctx, state, mocks };
}

describe('pollMarketNewsCardsStep', () => {
    beforeEach(() => {
        mockGetMarketNewsCardsAction.mockReset();
        vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('all cards enriched → returns stop, clearInterval and setIsPolling(false) called', async () => {
        mockGetMarketNewsCardsAction.mockResolvedValue({
            ok: true,
            items: [ENRICHED_ITEM],
        });

        const { ctx, mocks } = makeCtx();
        const result = await pollMarketNewsCardsStep(ctx);

        expect(result).toBe('stop');
        expect(mocks.clearInterval).toHaveBeenCalledOnce();
        expect(mocks.setIsPolling).toHaveBeenCalledWith(false);
        expect(mocks.setPollError).not.toHaveBeenCalled();
    });

    it('action returns ok: false → incrementFailures called, not yet at MAX → continue', async () => {
        mockGetMarketNewsCardsAction.mockResolvedValue({
            ok: false,
            error: 'db error',
        });

        // consecutiveFailures starts at 0 — after increment it will be 1, below MAX (3)
        const { ctx, mocks } = makeCtx({ consecutiveFailures: 0 });
        const result = await pollMarketNewsCardsStep(ctx);

        expect(result).toBe('continue');
        expect(mocks.incrementFailures).toHaveBeenCalledOnce();
        expect(mocks.clearInterval).not.toHaveBeenCalled();
        expect(mocks.setPollError).not.toHaveBeenCalled();
    });

    it('consecutive failures reach MAX_CONSECUTIVE_FAILURES → stop, setPollError and clearInterval called', async () => {
        mockGetMarketNewsCardsAction.mockResolvedValue({
            ok: false,
            error: 'db unavailable',
        });

        // Start at MAX - 1 so one more increment hits the threshold
        const { ctx, mocks } = makeCtx({
            consecutiveFailures: MAX_CONSECUTIVE_FAILURES - 1,
        });
        const result = await pollMarketNewsCardsStep(ctx);

        expect(result).toBe('stop');
        expect(mocks.incrementFailures).toHaveBeenCalledOnce();
        expect(mocks.setPollError).toHaveBeenCalledOnce();
        expect(mocks.setPollError.mock.calls[0][0]).toBeInstanceOf(Error);
        expect(mocks.setIsPolling).toHaveBeenCalledWith(false);
        expect(mocks.clearInterval).toHaveBeenCalledOnce();
    });

    it('items returned but none enriched, pollCount < EMPTY_SNAPSHOT_MAX_POLLS → continue, incrementPollCount called', async () => {
        mockGetMarketNewsCardsAction.mockResolvedValue({
            ok: true,
            items: [PENDING_ITEM],
        });

        const { ctx, mocks } = makeCtx({ pollCount: 0 });
        const result = await pollMarketNewsCardsStep(ctx);

        expect(result).toBe('continue');
        expect(mocks.incrementPollCount).toHaveBeenCalledOnce();
        expect(mocks.setItems).toHaveBeenCalledWith([PENDING_ITEM]);
        expect(mocks.clearInterval).not.toHaveBeenCalled();
    });

    it('empty snapshots reach EMPTY_SNAPSHOT_MAX_POLLS → stop', async () => {
        mockGetMarketNewsCardsAction.mockResolvedValue({
            ok: true,
            items: [],
        });

        // pollCount is at the threshold — after incrementPollCount it equals EMPTY_SNAPSHOT_MAX_POLLS
        const { ctx, mocks } = makeCtx({
            pollCount: EMPTY_SNAPSHOT_MAX_POLLS - 1,
        });
        const result = await pollMarketNewsCardsStep(ctx);

        expect(result).toBe('stop');
        expect(mocks.incrementPollCount).toHaveBeenCalledOnce();
        expect(mocks.setIsPolling).toHaveBeenCalledWith(false);
        expect(mocks.clearInterval).toHaveBeenCalledOnce();
    });

    it('startTime exceeds MAX_POLL_DURATION_MS → stop immediately without calling getMarketNewsCardsAction', async () => {
        // Use a startTime well in the past so Date.now() - startTime > MAX_POLL_DURATION_MS
        const pastStartTime = Date.now() - MAX_POLL_DURATION_MS - 1;
        const { ctx, mocks } = makeCtx({ startTime: pastStartTime });

        const result = await pollMarketNewsCardsStep(ctx);

        expect(result).toBe('stop');
        expect(mockGetMarketNewsCardsAction).not.toHaveBeenCalled();
        expect(mocks.setIsPolling).toHaveBeenCalledWith(false);
        expect(mocks.clearInterval).toHaveBeenCalledOnce();
    });
});
