'use client';

import { useQuery } from '@tanstack/react-query';
import type {
    MarketBriefingResponse,
    SubmitBriefingResult,
} from '@y0ngha/siglens-core';
import { submitMarketBriefingAction } from '@/entities/market-summary/actions';
import { useHydrated } from '@/shared/hooks/useHydrated';
import { QUERY_KEYS } from '@/shared/config/queryConfig';

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
        queryKey: QUERY_KEYS.marketBriefing(),
        queryFn: submitMarketBriefingAction,
        enabled: isHydrated,
        staleTime: Infinity,
    });

    if (!data) {
        // hydration 전: peek seed가 있으면 cached처럼 노출, 없으면 undefined(렌더 안 함)
        if (peekSeed) {
            // peek seed는 briefing 본문만 보유하므로 generatedAt이 빈 문자열이다.
            // BriefingCard는 비어있거나 유효하지 않은 타임스탬프를 가드해 렌더링하지 않으므로(R1 참조).
            const seed: SubmitBriefingResult = {
                status: 'cached',
                briefing: peekSeed,
                generatedAt: '',
            };
            return { input: seed };
        }
        return { input: undefined };
    }
    if ('ok' in data) return { input: undefined };
    if (data.botBlocked) return { input: null };
    return { input: data.briefing };
}
