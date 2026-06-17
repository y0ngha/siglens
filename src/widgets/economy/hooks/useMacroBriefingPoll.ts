'use client';

import { useQuery } from '@tanstack/react-query';
import type { MacroBriefingResponse } from '@y0ngha/siglens-core';

import { pollMacroBriefingAction } from '@/entities/economy/actions/pollMacroBriefingAction';
import { QUERY_KEYS } from '@/shared/config/queryConfig';
import { useHydrated } from '@/shared/hooks/useHydrated';

const POLL_INTERVAL_MS = 5_000;

/**
 * 폴링 위젯이 단일 union으로 받는 결과.
 * error variant는 throw 대신 명시적으로 반환해 위젯이 inline notice를 렌더하게 한다
 * (route 단위 error boundary로 빠지면 grid·calendar까지 함께 unmount되므로 회피).
 */
export type MacroBriefingPollResult =
    | { status: 'processing' }
    | { status: 'error'; error: string }
    | { status: 'done'; briefing: MacroBriefingResponse; generatedAt: string };

/**
 * jobId가 끝날 때까지 5초 간격으로 poll. done/error 도달 시 polling 종료.
 * error는 위젯이 inline notice로 surface하도록 결과 union의 variant로 노출한다.
 */
export function useMacroBriefingPoll(jobId: string): MacroBriefingPollResult {
    const isHydrated = useHydrated();
    const { data } = useQuery({
        queryKey: QUERY_KEYS.macroBriefingPoll(jobId),
        queryFn: () => pollMacroBriefingAction(jobId),
        enabled: isHydrated,
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
