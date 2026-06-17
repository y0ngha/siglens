'use client';

import { useQuery } from '@tanstack/react-query';
import type { PollMacroBriefingResult } from '@y0ngha/siglens-core';

import { pollMacroBriefingAction } from '@/entities/economy/actions/pollMacroBriefingAction';
import { QUERY_KEYS } from '@/shared/config/queryConfig';
import { useHydrated } from '@/shared/hooks/useHydrated';

const POLL_INTERVAL_MS = 5_000;

/**
 * jobId가 끝날 때까지 5초 간격으로 poll. done/error 도달 시 polling 종료.
 *
 * core의 `PollMacroBriefingResult`(processing | error | done)를 그대로 반환한다 —
 * error variant를 throw로 raise하지 않고 결과 union으로 surface해 위젯이 inline notice를
 * 렌더한다(route 단위 error boundary로 빠지면 grid·calendar까지 함께 unmount되므로 회피).
 */
export function useMacroBriefingPoll(jobId: string): PollMacroBriefingResult {
    const isHydrated = useHydrated();
    const { data } = useQuery({
        queryKey: QUERY_KEYS.macroBriefingPoll(jobId),
        queryFn: () => pollMacroBriefingAction(jobId),
        enabled: isHydrated && jobId !== '',
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
    if (data.status === 'error') {
        return { status: 'error', error: data.error };
    }
    return {
        status: 'done',
        briefing: data.briefing,
        generatedAt: data.generatedAt,
    };
}
