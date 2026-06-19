'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { CongressTrendResponse, ModelId } from '@y0ngha/siglens-core';
import {
    submitCongressTrendAction,
    pollCongressTrendAction,
    cancelCongressTrendJobAction,
} from '@/entities/analysis/actions';
import { sleep } from '@/shared/lib/sleep';
import { QUERY_KEYS } from '@/shared/config/queryConfig';
import {
    ANALYSIS_POLL_INTERVAL_MS,
    ANALYSIS_POLL_MAX_DURATION_MS,
} from '@/shared/config/pollingConfig';
import { usePageHideCancel } from '@/shared/hooks/usePageHideCancel';
import { useHydrated } from '@/shared/hooks/useHydrated';
import { BotBlockedError } from '@/widgets/symbol-page';
import type { CancelJobEntry } from '@/shared/lib/types';

/**
 * Sentinel exception used to carry the `no_trades` outcome from the React
 * Query `queryFn` (which can only resolve to data or throw) into the hook's
 * state machine — there it is mapped to `{ status: 'no_trades' }`.
 *
 * Congress 0건 is NOT an error: many symbols simply have no disclosures, so
 * we deliberately do not enqueue an LLM job. Surfacing as a typed throw lets
 * React Query treat the query as "settled, no data" without polluting the
 * cache with a fake response object.
 */
class NoCongressTradesError extends Error {
    constructor() {
        super('no_trades');
        this.name = 'NoCongressTradesError';
    }
}

export type CongressTrendState =
    | { status: 'loading' }
    | { status: 'done'; result: CongressTrendResponse }
    | { status: 'no_trades' }
    | { status: 'bot_blocked' }
    | { status: 'error'; error: Error; retry: () => void };

// onJobId는 두 번째 인자(expectedCurrent)를 받으면 ref가 일치할 때만 갱신한다 →
// retry/queryKey 변경으로 새 실행이 시작된 뒤에도 이전 실행의 finally가
// 새 jobId를 null로 덮어쓰지 않는다. (mirrors useFinancialsAnalysis)
async function fetchCongressTrend(
    symbol: string,
    modelId: ModelId,
    signal: AbortSignal,
    onJobId: (jobId: string | null, expectedCurrent?: string | null) => void
): Promise<CongressTrendResponse> {
    const submitted = await submitCongressTrendAction(symbol, modelId);

    if (submitted.status === 'cached') return submitted.result;
    if (submitted.status === 'miss_no_trigger') {
        throw new BotBlockedError();
    }
    if (submitted.status === 'no_trades') {
        throw new NoCongressTradesError();
    }
    if (submitted.status === 'error') {
        throw new Error(
            submitted.error ?? '의회 거래 데이터를 불러오지 못했습니다.'
        );
    }

    onJobId(submitted.jobId);
    const pollStartTime = Date.now();
    try {
        const { jobId } = submitted;
        while (!signal.aborted) {
            await sleep(ANALYSIS_POLL_INTERVAL_MS);
            if (signal.aborted) break;
            if (Date.now() - pollStartTime > ANALYSIS_POLL_MAX_DURATION_MS) {
                throw new Error(
                    '동향 해석이 응답하지 않습니다. 잠시 후 다시 시도해 주세요.'
                );
            }
            const polled = await pollCongressTrendAction(jobId);
            if (polled.status === 'done') return polled.result;
            if (polled.status === 'error') {
                throw new Error(
                    polled.error ?? '동향 해석 중 오류가 발생했습니다.'
                );
            }
        }
    } finally {
        // 이 실행이 설정한 jobId가 ref에 그대로 있을 때만 null로 비운다.
        onJobId(null, submitted.jobId);
    }
    throw new Error('aborted');
}

export function useCongressTrend(
    symbol: string,
    modelId: ModelId
): CongressTrendState {
    const currentJobIdRef = useRef<string | null>(null);
    const queryClient = useQueryClient();
    const isHydrated = useHydrated();

    // queryKey는 인라인으로 둔다(§17 훅 순서). React Query는 queryKey를
    // deep-equality로 비교하므로 매 렌더 새 배열 참조가 생성돼도 불필요한
    // 재페치가 발생하지 않는다.
    const query = useQuery({
        queryKey: QUERY_KEYS.congressTrend(symbol, modelId),
        queryFn: ({ signal, queryKey: [, qSymbol, qModelId] }) =>
            fetchCongressTrend(
                qSymbol,
                qModelId,
                signal,
                (jobId, expectedCurrent) => {
                    if (
                        expectedCurrent !== undefined &&
                        currentJobIdRef.current !== expectedCurrent
                    ) {
                        return;
                    }
                    currentJobIdRef.current = jobId;
                }
            ),
        enabled: false,
        retry: false,
        staleTime: Infinity,
    });

    const { refetch } = query;

    const retry = useCallback(() => {
        void refetch();
    }, [refetch]);

    // ref를 null로 초기화해 unmount cleanup과의 이중 cancel을 방지한다.
    const getPageHideJobs = useCallback((): CancelJobEntry[] | null => {
        const jobId = currentJobIdRef.current;
        if (jobId === null) return null;
        currentJobIdRef.current = null;
        return [{ jobId, type: 'congress' as const }];
    }, []);
    usePageHideCancel(getPageHideJobs);

    useEffect(() => {
        if (!isHydrated) return;
        if (
            queryClient.getQueryData(
                QUERY_KEYS.congressTrend(symbol, modelId)
            ) === undefined
        ) {
            void refetch();
        }
    }, [isHydrated, queryClient, symbol, modelId, refetch]);

    useEffect(() => {
        return () => {
            const jobId = currentJobIdRef.current;
            if (jobId !== null) {
                currentJobIdRef.current = null;
                void cancelCongressTrendJobAction(jobId).catch(error => {
                    console.warn('[useCongressTrend] cancel failed', error);
                });
            }
        };
    }, [symbol, modelId]);

    if (query.isError) {
        if (query.error instanceof BotBlockedError) {
            return { status: 'bot_blocked' };
        }
        if (query.error instanceof NoCongressTradesError) {
            return { status: 'no_trades' };
        }
        return {
            status: 'error',
            error:
                query.error instanceof Error
                    ? query.error
                    : new Error('동향 해석 중 오류가 발생했습니다.'),
            retry,
        };
    }

    if (query.data !== undefined) {
        return { status: 'done', result: query.data };
    }

    return { status: 'loading' };
}
