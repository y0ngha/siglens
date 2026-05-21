'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type {
    FundamentalAnalysisResponse,
    ModelId,
} from '@y0ngha/siglens-core';
import { submitFundamentalAnalysisAction } from '@/infrastructure/market/submitFundamentalAnalysisAction';
import { isGateBlockedResult } from '@/domain/analysis/gate';
import { pollFundamentalAnalysisAction } from '@/infrastructure/market/pollFundamentalAnalysisAction';
import { cancelFundamentalAnalysisJobAction } from '@/infrastructure/market/cancelFundamentalAnalysisJobAction';
import { sleep } from '@/lib/sleep';
import { QUERY_KEYS } from '@/lib/queryConfig';
import { ANALYSIS_POLL_INTERVAL_MS } from '@/lib/pollingConfig';
import { usePageHideCancel } from '@/components/hooks/usePageHideCancel';
import { BotBlockedError } from '@/components/symbol-page/exceptions/BotBlockedError';
import type { CancelJobEntry } from '@/domain/types';

export type FundamentalAnalysisState =
    | { status: 'loading' }
    | { status: 'done'; result: FundamentalAnalysisResponse }
    | { status: 'bot_blocked' }
    | { status: 'error'; error: Error; retry: () => void };

// AbortSignal로 unmount 시 폴링을 즉시 종료한다.
// onJobId는 두 번째 인자(expectedCurrent)를 받으면 ref가 일치할 때만 갱신한다 →
// retry/queryKey 변경으로 새 실행이 시작된 뒤에도 이전 실행의 finally가
// 새 jobId를 null로 덮어쓰지 않는다.
async function fetchFundamentalAnalysis(
    symbol: string,
    modelId: ModelId,
    signal: AbortSignal,
    onJobId: (jobId: string | null, expectedCurrent?: string | null) => void
): Promise<FundamentalAnalysisResponse> {
    const submitted = await submitFundamentalAnalysisAction(symbol, modelId);

    if (submitted.status === 'cached') return submitted.result;
    if (submitted.status === 'miss_no_trigger') {
        throw new BotBlockedError();
    }
    if (submitted.status === 'error') {
        // Handle before the existing SubmitFundamentalAnalysisResult variants.
        if (isGateBlockedResult(submitted)) {
            throw new Error(submitted.error.message);
        }
        const message =
            submitted.code === 'fetch_failed'
                ? (submitted.error ?? '데이터를 불러오지 못했습니다.')
                : '사용량 한도를 초과했습니다.';
        throw new Error(message);
    }
    if (submitted.status === 'key_error') {
        throw new Error(submitted.error);
    }

    onJobId(submitted.jobId);
    try {
        const { jobId } = submitted;
        while (!signal.aborted) {
            await sleep(ANALYSIS_POLL_INTERVAL_MS);
            if (signal.aborted) break;
            const polled = await pollFundamentalAnalysisAction(jobId);
            if (polled.status === 'done') return polled.result;
            if (polled.status === 'error') {
                throw new Error(polled.error ?? '분석 중 오류가 발생했습니다.');
            }
        }
    } finally {
        // 이 실행이 설정한 jobId가 ref에 그대로 있을 때만 null로 비운다.
        onJobId(null, submitted.jobId);
    }
    throw new Error('aborted');
}

export function useFundamentalAnalysis(
    symbol: string,
    modelId: ModelId
): FundamentalAnalysisState {
    const queryClient = useQueryClient();
    const currentJobIdRef = useRef<string | null>(null);
    const queryKey = useMemo(
        () => QUERY_KEYS.fundamentalAnalysis(symbol, modelId),
        [symbol, modelId]
    );

    const query = useQuery({
        queryKey,
        queryFn: ({ signal }) =>
            fetchFundamentalAnalysis(
                symbol,
                modelId,
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

    // §17 exception: `refetch` is destructured immediately after useQuery
    // because it feeds the useCallback below — derived values that are
    // consumed by subsequent hook calls must precede those hooks. The
    // `refetch` reference is stable across renders (React Query guarantee).
    const { refetch } = query;

    const retry = useCallback(() => {
        void refetch();
    }, [refetch]);

    // ref를 null로 초기화해 unmount cleanup과의 이중 cancel을 방지한다.
    const getPageHideJobs = useCallback((): CancelJobEntry[] | null => {
        const jobId = currentJobIdRef.current;
        if (jobId === null) return null;
        currentJobIdRef.current = null;
        return [{ jobId, type: 'fundamental' as const }];
    }, []);
    usePageHideCancel(getPageHideJobs);

    useEffect(() => {
        if (queryClient.getQueryData(queryKey) === undefined) {
            void refetch();
        }
    }, [queryClient, queryKey, refetch]);

    // symbol 또는 modelId 변경(queryKey 교체) 시, unmount 시 진행 중인 job을 cancel한다.
    // fire-and-forget이므로 useMutation 없이 직접 호출한다.
    useEffect(() => {
        return () => {
            const jobId = currentJobIdRef.current;
            if (jobId !== null) {
                currentJobIdRef.current = null;
                void cancelFundamentalAnalysisJobAction(jobId).catch(error => {
                    console.warn(
                        '[useFundamentalAnalysis] cancel failed',
                        error
                    );
                });
            }
        };
    }, [queryKey]);

    if (query.isError) {
        if (query.error instanceof BotBlockedError) {
            return { status: 'bot_blocked' };
        }
        return {
            status: 'error',
            error:
                query.error instanceof Error
                    ? query.error
                    : new Error('분석 중 오류가 발생했습니다.'),
            retry,
        };
    }

    if (query.data !== undefined) {
        return { status: 'done', result: query.data };
    }

    return { status: 'loading' };
}
