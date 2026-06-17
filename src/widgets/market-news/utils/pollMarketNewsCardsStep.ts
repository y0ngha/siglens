import { getMarketNewsCardsAction } from '@/entities/market-news/actions';
import type { MarketNewsCardItem } from '@/entities/market-news/actions';
import type { NewsFeedCategory } from '@y0ngha/siglens-core';
import {
    MAX_CONSECUTIVE_FAILURES,
    EMPTY_SNAPSHOT_MAX_POLLS,
    MAX_POLL_DURATION_MS,
} from '../constants';

export interface PollState {
    pollCount: number;
    consecutiveFailures: number;
    startTime: number;
}

export interface PollMarketNewsCardsContext {
    category: NewsFeedCategory;
    // setters (encapsulate state mutation so pollMarketNewsCardsStep is a pure function of the context object):
    incrementFailures: () => void;
    resetFailures: () => void;
    incrementPollCount: () => void;
    getStartTime: () => number;
    getPollCount: () => number;
    getConsecutiveFailures: () => number;
    // UI setters / notifications:
    setItems: (next: MarketNewsCardItem[]) => void;
    setIsPolling: (next: boolean) => void;
    setPollError: (next: Error | null) => void;
    clearInterval: () => void;
}

function hasPendingAnalysis(items: MarketNewsCardItem[]): boolean {
    return items.some(
        item => item.sentiment === null || item.priceImpact === null
    );
}

/** One polling tick. Pure function of the explicit context object — no closure capture, unit-testable. */
export async function pollMarketNewsCardsStep(
    ctx: PollMarketNewsCardsContext
): Promise<'continue' | 'stop'> {
    if (Date.now() - ctx.getStartTime() > MAX_POLL_DURATION_MS) {
        ctx.setIsPolling(false);
        ctx.clearInterval();
        return 'stop';
    }

    const result = await getMarketNewsCardsAction(ctx.category);
    if (!result.ok) {
        ctx.incrementFailures();
        console.error('[useMarketNewsCardPolling] poll failed:', result.error);

        if (ctx.getConsecutiveFailures() >= MAX_CONSECUTIVE_FAILURES) {
            ctx.setPollError(new Error(result.error));
            ctx.setIsPolling(false);
            ctx.clearInterval();
            return 'stop';
        }
        return 'continue';
    }
    ctx.resetFailures();
    const fresh = result.items;
    ctx.incrementPollCount();
    ctx.setItems(fresh);

    if (fresh.length === 0 && ctx.getPollCount() >= EMPTY_SNAPSHOT_MAX_POLLS) {
        ctx.setIsPolling(false);
        ctx.clearInterval();
        return 'stop';
    } else if (fresh.length > 0 && !hasPendingAnalysis(fresh)) {
        ctx.setIsPolling(false);
        ctx.clearInterval();
        return 'stop';
    }

    return 'continue';
}
