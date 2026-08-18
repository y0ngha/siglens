import { getMarketNewsCardsAction } from '@/entities/market-news/actions';
import type { MarketNewsCardItem } from '@/entities/market-news';
import type { NewsFeedCategory } from '@y0ngha/siglens-core';
import {
    MAX_CONSECUTIVE_FAILURES,
    EMPTY_SNAPSHOT_MAX_POLLS,
    MAX_POLL_DURATION_MS,
    STAGNANT_POLL_LIMIT,
    STAGNATION_FLOOR_POLLS,
} from '../constants';
import type { PollStepResult } from './pollStepResult';

export interface PollMarketNewsCardsContext {
    category: NewsFeedCategory;
    // setters (encapsulate state mutation so pollMarketNewsCardsStep is a pure function of the context object):
    incrementFailures: () => void;
    resetFailures: () => void;
    incrementPollCount: () => void;
    getStartTime: () => number;
    getPollCount: () => number;
    getConsecutiveFailures: () => number;
    /** 지금까지 관측한 보강 카드 수의 최댓값. 정체 판정의 기준선이다. */
    getEnrichedCount: () => number;
    /** 보강 수가 늘면 기준선을 올리고 정체 카운터를 0으로 되돌린다. */
    recordEnriched: (count: number) => void;
    getStagnantPolls: () => number;
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
): Promise<PollStepResult> {
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

    // 종목 뉴스 폴러와 같은 이유의 정체 종료(감사: 비용 라운드 15~16).
    // 종료 조건이 "버킷 안 **모든** 카드가 보강됨"인데, 영구히 `analyzedAt=null`로
    // 남는 행이 설계상 존재한다 — 빈 분석 결과는 일부러 persist하지 않고
    // (`ensureMarketNewsCardsAnalyzedAction`), 개별 실패는 삼켜진다. 그런 행은
    // FMP 최신 50건 밖으로 밀려나면 다시 후보가 되지 않으므로, 그 카테고리
    // 페이지를 여는 모든 방문자가 100틱 상한을 그대로 문다.
    ctx.recordEnriched(fresh.filter(item => item.sentiment !== null).length);

    if (fresh.length === 0 && ctx.getPollCount() >= EMPTY_SNAPSHOT_MAX_POLLS) {
        ctx.setIsPolling(false);
        ctx.clearInterval();
        return 'stop';
    } else if (
        ctx.getEnrichedCount() > 0 &&
        ctx.getPollCount() >= STAGNATION_FLOOR_POLLS &&
        ctx.getStagnantPolls() >= STAGNANT_POLL_LIMIT
    ) {
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
