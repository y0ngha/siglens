/**
 * Unit tests for waitForMarketNewsCardsStep.
 *
 * Uses a hand-built WaitForMarketNewsCardsContext with vi.fn() setters and
 * controlled getter state to cover all branching paths without invoking real
 * server actions or React state.
 */

import type { MockedFunction } from 'vitest';
import type { MarketNewsCardItem } from '@/entities/market-news/actions';
import { getMarketNewsCardsAction } from '@/entities/market-news/actions';
import { MAX_CONSECUTIVE_FAILURES } from '@/widgets/market-news/constants';
import {
    waitForMarketNewsCardsStep,
    type WaitForMarketNewsCardsContext,
} from '../utils/waitForMarketNewsCardsStep';

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
    id: 'mn-enriched-wait-1',
    publishedAt: '2026-06-15T10:00:00.000Z',
    titleEn: 'Market rally continues',
    titleKo: '시장 랠리 지속',
    sentiment: 'bullish',
    category: 'macro',
    bodyKo: '주식 시장 랠리가 계속되고 있습니다.',
    summaryKo: '시장 강세.',
    priceImpact: 'high',
    url: 'https://example.com/rally',
    source: 'Bloomberg',
    tickers: ['SPY', 'QQQ'],
};

const PENDING_ITEM: MarketNewsCardItem = {
    ...ENRICHED_ITEM,
    id: 'mn-pending-wait-1',
    sentiment: null,
    priceImpact: null,
    category: null,
    bodyKo: null,
    summaryKo: null,
};

/**
 * Build a minimal WaitForMarketNewsCardsContext with all setters as vi.fn()
 * and getters backed by a mutable state object.
 */
function makeCtx(initialFailures = 0): {
    ctx: WaitForMarketNewsCardsContext;
    state: { consecutiveFailures: number };
    mocks: {
        incrementFailures: ReturnType<typeof vi.fn>;
        resetFailures: ReturnType<typeof vi.fn>;
        setIsReady: ReturnType<typeof vi.fn>;
        setWaitError: ReturnType<typeof vi.fn>;
        clearInterval: ReturnType<typeof vi.fn>;
    };
} {
    const state = { consecutiveFailures: initialFailures };

    const mocks = {
        incrementFailures: vi.fn(() => {
            state.consecutiveFailures += 1;
        }),
        resetFailures: vi.fn(() => {
            state.consecutiveFailures = 0;
        }),
        setIsReady: vi.fn(),
        setWaitError: vi.fn(),
        clearInterval: vi.fn(),
    };

    const ctx: WaitForMarketNewsCardsContext = {
        category: 'general',
        incrementFailures: mocks.incrementFailures,
        resetFailures: mocks.resetFailures,
        getConsecutiveFailures: () => state.consecutiveFailures,
        setIsReady: mocks.setIsReady,
        setWaitError: mocks.setWaitError,
        clearInterval: mocks.clearInterval,
    };

    return { ctx, state, mocks };
}

describe('waitForMarketNewsCardsStep', () => {
    beforeEach(() => {
        mockGetMarketNewsCardsAction.mockReset();
        vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('action returns ok: true with ≥1 enriched item → setIsReady(true), clearInterval, stop', async () => {
        mockGetMarketNewsCardsAction.mockResolvedValue({
            ok: true,
            items: [ENRICHED_ITEM],
        });

        const { ctx, mocks } = makeCtx();
        const result = await waitForMarketNewsCardsStep(ctx);

        expect(result).toBe('stop');
        expect(mocks.setIsReady).toHaveBeenCalledWith(true);
        expect(mocks.clearInterval).toHaveBeenCalledOnce();
        expect(mocks.setWaitError).not.toHaveBeenCalled();
    });

    it('action returns ok: true with no enriched items → continue', async () => {
        mockGetMarketNewsCardsAction.mockResolvedValue({
            ok: true,
            items: [PENDING_ITEM],
        });

        const { ctx, mocks } = makeCtx();
        const result = await waitForMarketNewsCardsStep(ctx);

        expect(result).toBe('continue');
        expect(mocks.setIsReady).not.toHaveBeenCalled();
        expect(mocks.clearInterval).not.toHaveBeenCalled();
        expect(mocks.resetFailures).toHaveBeenCalledOnce();
    });

    it('action returns ok: false → incrementFailures called, below threshold → continue', async () => {
        mockGetMarketNewsCardsAction.mockResolvedValue({
            ok: false,
            error: 'network error',
        });

        // consecutiveFailures starts at 0, after increment it's 1 — below MAX (3)
        const { ctx, mocks } = makeCtx(0);
        const result = await waitForMarketNewsCardsStep(ctx);

        expect(result).toBe('continue');
        expect(mocks.incrementFailures).toHaveBeenCalledOnce();
        expect(mocks.setWaitError).not.toHaveBeenCalled();
        expect(mocks.clearInterval).not.toHaveBeenCalled();
    });

    it('consecutive failures reach MAX_CONSECUTIVE_FAILURES → stop, setWaitError and clearInterval called', async () => {
        mockGetMarketNewsCardsAction.mockResolvedValue({
            ok: false,
            error: 'timeout error',
        });

        // Start at MAX - 1 so one increment hits the threshold
        const { ctx, mocks } = makeCtx(MAX_CONSECUTIVE_FAILURES - 1);
        const result = await waitForMarketNewsCardsStep(ctx);

        expect(result).toBe('stop');
        expect(mocks.incrementFailures).toHaveBeenCalledOnce();
        expect(mocks.setWaitError).toHaveBeenCalledOnce();
        const err = mocks.setWaitError.mock.calls[0][0];
        expect(err).toBeInstanceOf(Error);
        expect(err.message).toBe('timeout error');
        expect(mocks.clearInterval).toHaveBeenCalledOnce();
    });

    it('mixed items: enriched + pending → stops because ≥1 item has sentiment', async () => {
        mockGetMarketNewsCardsAction.mockResolvedValue({
            ok: true,
            items: [PENDING_ITEM, ENRICHED_ITEM],
        });

        const { ctx, mocks } = makeCtx();
        const result = await waitForMarketNewsCardsStep(ctx);

        expect(result).toBe('stop');
        expect(mocks.setIsReady).toHaveBeenCalledWith(true);
    });

    it('empty items list → continue (no enriched items)', async () => {
        mockGetMarketNewsCardsAction.mockResolvedValue({
            ok: true,
            items: [],
        });

        const { ctx, mocks } = makeCtx();
        const result = await waitForMarketNewsCardsStep(ctx);

        expect(result).toBe('continue');
        expect(mocks.setIsReady).not.toHaveBeenCalled();
        expect(mocks.clearInterval).not.toHaveBeenCalled();
    });
});
