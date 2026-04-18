'use client';

import { useQuery } from '@tanstack/react-query';
import { pollBriefingAction } from '@/infrastructure/market/pollBriefingAction';
import { QUERY_KEYS } from '@/lib/queryConfig';

const POLL_INTERVAL_MS = 5_000;

interface UseBriefingResult {
    briefing: string | null;
    isLoading: boolean;
    error: string | null;
}

export function useBriefing(
    jobId: string | undefined,
    initialBriefing: string | undefined
): UseBriefingResult {
    const { data } = useQuery({
        queryKey: QUERY_KEYS.briefing(jobId ?? ''),
        queryFn: () => pollBriefingAction(jobId!),
        enabled: !!jobId,
        refetchInterval: query => {
            const status = query.state.data?.status;
            return status === 'done' || status === 'error'
                ? false
                : POLL_INTERVAL_MS;
        },
        staleTime: Infinity,
    });

    const briefing =
        initialBriefing ?? (data?.status === 'done' ? data.briefing : null);
    const isLoading =
        !!jobId &&
        !initialBriefing &&
        data?.status !== 'done' &&
        data?.status !== 'error';
    const error = data?.status === 'error' ? data.error : null;

    return { briefing, isLoading, error };
}
