'use client';

import { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import type {
    PollMacroBriefingDone,
    PollMacroBriefingError,
} from '@y0ngha/siglens-core';

import { pollMacroBriefingAction } from '@/entities/economy/actions/pollMacroBriefingAction';
import { QUERY_KEYS } from '@/shared/config/queryConfig';
import { ANALYSIS_POLL_MAX_DURATION_MS } from '@/shared/config/pollingConfig';
import { useHydrated } from '@/shared/hooks/useHydrated';

const POLL_INTERVAL_MS = 5_000;

/**
 * 폴링 결과 union — core의 PollMacroBriefingResult에 `refetch` 콜백이 추가된 형태.
 * error variant는 재시도 버튼이, processing variant는 아직 로딩 중임을 표시한다.
 */
export type UseMacroBriefingPollResult =
    | ({ status: 'processing' } & { refetch: () => void })
    | (PollMacroBriefingError & { refetch: () => void })
    | (PollMacroBriefingDone & { refetch: () => void });

/**
 * jobId가 끝날 때까지 5초 간격으로 poll. done/error 도달 시 polling 종료.
 *
 * core의 `PollMacroBriefingResult`(processing | error | done)를 그대로 반환한다 —
 * error variant를 throw로 raise하지 않고 결과 union으로 surface해 위젯이 inline notice를
 * 렌더한다(route 단위 error boundary로 빠지면 grid·calendar까지 함께 unmount되므로 회피).
 *
 * 폴링 경과 시간이 `ANALYSIS_POLL_MAX_DURATION_MS`(5분)를 초과하면 error 상태로
 * 전환한다 — 잡이 stall됐을 때 무한 스켈레톤 대신 재시도 가능한 오류 화면을 보여준다.
 */
export function useMacroBriefingPoll(
    jobId: string
): UseMacroBriefingPollResult {
    const isHydrated = useHydrated();

    /**
     * `timedOut` becomes true when the ceiling timer fires while polling is
     * still in `processing`. A separate boolean state (rather than deriving
     * from Date.now() during render) ensures the component re-renders as soon
     * as the ceiling is reached, showing MacroBriefingError immediately.
     */
    const [timedOut, setTimedOut] = useState(false);

    /**
     * Monotonically-increasing counter that identifies the current poll window.
     * Incrementing it on retry causes the ceiling `useEffect` to re-run even
     * though `isSettled` is still `false`, which arms a fresh ceiling timer for
     * the new window and prevents the infinite-skeleton bug.
     */
    const [pollWindow, setPollWindow] = useState(0);

    // §17 exception: `refetch` is destructured immediately after useQuery
    // because it feeds the useCallback below. The `refetch` reference is
    // stable across renders (React Query guarantees this).
    const { data, refetch: queryRefetch } = useQuery({
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

    const isSettled = data?.status === 'done' || data?.status === 'error';

    /**
     * Hard-ceiling timer: if the job is still `processing` after
     * `ANALYSIS_POLL_MAX_DURATION_MS`, flip `timedOut` to force an error render
     * so the user sees a retryable error instead of an infinite skeleton.
     *
     * The effect re-runs whenever `isSettled` or `pollWindow` changes:
     * - `isSettled` transition → clears the timer once the job finishes.
     * - `pollWindow` increment (triggered by `refetch`) → arms a fresh ceiling
     *   timer for the new attempt even though `isSettled` is still `false`.
     *   Without this second dependency, a retry on a still-stalled job would
     *   never re-arm the timer and the ceiling would never fire again.
     */
    useEffect(() => {
        if (isSettled) return;

        const id = setTimeout(() => {
            setTimedOut(true);
        }, ANALYSIS_POLL_MAX_DURATION_MS);

        return () => {
            clearTimeout(id);
        };
    }, [isSettled, pollWindow]);

    const refetch = useCallback(() => {
        // Reset the timeout flag and advance the poll-window counter so the
        // ceiling useEffect re-runs and arms a fresh timer for this attempt.
        setTimedOut(false);
        setPollWindow(w => w + 1);
        void queryRefetch();
    }, [queryRefetch]);

    if (timedOut && !isSettled) {
        return { status: 'error', error: 'poll_timeout', refetch };
    }

    if (!data || data.status === 'processing') {
        return { status: 'processing', refetch };
    }
    if (data.status === 'error') {
        return { status: 'error', error: data.error, refetch };
    }
    return {
        status: 'done',
        briefing: data.briefing,
        generatedAt: data.generatedAt,
        refetch,
    };
}
