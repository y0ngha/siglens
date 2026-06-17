import { getMarketNewsCardsAction } from '@/entities/market-news/actions';
import type { NewsFeedCategory } from '@y0ngha/siglens-core';
import { MAX_CONSECUTIVE_FAILURES } from '../constants';

export interface WaitState {
    consecutiveFailures: number;
}

export interface WaitForMarketNewsCardsContext {
    category: NewsFeedCategory;
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
): Promise<'continue' | 'stop'> {
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
