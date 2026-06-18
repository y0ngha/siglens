import { getMarketNewsCardsAction } from '@/entities/market-news/actions';
import type { NewsFeedCategory } from '@y0ngha/siglens-core';
import { MAX_CONSECUTIVE_FAILURES, MAX_POLL_DURATION_MS } from '../constants';
import type { PollStepResult } from './pollStepResult';

export interface WaitForMarketNewsCardsContext {
    category: NewsFeedCategory;
    /** Timestamp (Date.now()) when the wait loop started. Used to enforce the hard ceiling. */
    startedAt: number;
    // setters (encapsulate state mutation so waitForMarketNewsCardsStep is a pure function of the context object):
    incrementFailures: () => void;
    resetFailures: () => void;
    getConsecutiveFailures: () => number;
    // UI setters / notifications:
    setIsReady: (next: boolean) => void;
    setWaitError: (next: Error | null) => void;
    clearInterval: () => void;
}

/** One wait tick. Pure function of the explicit context object — no closure capture, unit-testable. */
export async function waitForMarketNewsCardsStep(
    ctx: WaitForMarketNewsCardsContext
): Promise<PollStepResult> {
    // Hard ceiling: bail out if the loop has been running longer than MAX_POLL_DURATION_MS.
    // Prevents infinite wait when FMP returns empty results or all LLM jobs silently fail.
    if (Date.now() - ctx.startedAt >= MAX_POLL_DURATION_MS) {
        ctx.setWaitError(new Error('timeout'));
        ctx.clearInterval();
        return 'stop';
    }

    const result = await getMarketNewsCardsAction(ctx.category);
    if (!result.ok) {
        ctx.incrementFailures();
        console.error('[useWaitForMarketNewsCards] poll failed:', result.error);
        if (ctx.getConsecutiveFailures() >= MAX_CONSECUTIVE_FAILURES) {
            ctx.setWaitError(new Error(result.error));
            ctx.clearInterval();
            return 'stop';
        }
        return 'continue';
    }
    ctx.resetFailures();
    if (result.items.some(item => item.sentiment !== null)) {
        ctx.setIsReady(true);
        ctx.clearInterval();
        return 'stop';
    }

    return 'continue';
}
