'use client';

import { useQuery } from '@tanstack/react-query';
import { pollBriefingAction } from '@/infrastructure/market/pollBriefingAction';
import { QUERY_KEYS } from '@/lib/queryConfig';
import type { MarketBriefingResponse } from '@/domain/types';

const POLL_INTERVAL_MS = 5_000;

type BriefingResult =
    | { status: 'processing' }
    | { status: 'done'; briefing: MarketBriefingResponse; generatedAt: string };

export function useBriefing(jobId: string): BriefingResult {
    const { data } = useQuery({
        queryKey: QUERY_KEYS.briefing(jobId),
        queryFn: () => pollBriefingAction(jobId),
        refetchInterval: query => {
            const status = query.state.data?.status;

            return status === 'done' || status === 'error'
                ? false
                : POLL_INTERVAL_MS;
        },
        staleTime: Infinity,
        refetchIntervalInBackground: true,
    });

    if (!data || data.status === 'processing') return { status: 'processing' };
    if (data.status === 'error') throw new Error(data.error);
    return {
        status: 'done',
        briefing: data.briefing,
        generatedAt: data.generatedAt,
    };
}
