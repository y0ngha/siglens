'use client';

import { useQuery } from '@tanstack/react-query';
import type {
    MarketBriefingResponse,
    SubmitBriefingResult,
} from '@y0ngha/siglens-core';
import { submitMarketBriefingAction } from '@/entities/market-summary/actions';
import { useHydrated } from '@/shared/hooks/useHydrated';

export interface UseMarketBriefingReturn {
    /** BriefingRegion input — undefined=미정, null=봇, cached/submitted=정상. */
    input: SubmitBriefingResult | null | undefined;
}

/**
 * 마운트 후 submitMarketBriefingAction을 호출해 briefing을 트리거한다. peekSeed가
 * 있으면 초기 표시에 쓰고, action 결과로 교체한다. 봇이면 null(BotBlockedNotice).
 */
export function useMarketBriefing(
    peekSeed?: MarketBriefingResponse | null
): UseMarketBriefingReturn {
    const isHydrated = useHydrated();
    const { data } = useQuery({
        queryKey: ['market-briefing'],
        queryFn: submitMarketBriefingAction,
        enabled: isHydrated,
        staleTime: Infinity,
    });

    if (!data) {
        // hydration 전: peek seed가 있으면 cached처럼 노출, 없으면 undefined(렌더 안 함)
        return {
            input: peekSeed
                ? ({
                      status: 'cached',
                      briefing: peekSeed,
                      generatedAt: '',
                  } as SubmitBriefingResult)
                : undefined,
        };
    }
    if ('ok' in data) return { input: undefined };
    if (data.botBlocked) return { input: null };
    return { input: data.briefing };
}
