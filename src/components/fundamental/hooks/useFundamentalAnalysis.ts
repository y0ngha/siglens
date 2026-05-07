'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type {
    FundamentalAnalysisResponse,
    ModelId,
} from '@y0ngha/siglens-core';
import { submitFundamentalAnalysisAction } from '@/infrastructure/market/submitFundamentalAnalysisAction';
import { pollFundamentalAnalysisAction } from '@/infrastructure/market/pollFundamentalAnalysisAction';
import { cancelFundamentalAnalysisJobAction } from '@/infrastructure/market/cancelFundamentalAnalysisJobAction';
import { sleep } from '@/lib/sleep';
import { QUERY_KEYS } from '@/lib/queryConfig';
import { FUNDAMENTAL_NEWS_POLL_INTERVAL_MS } from '@/lib/pollingConfig';

export type FundamentalAnalysisState =
    | { status: 'loading' }
    | { status: 'done'; result: FundamentalAnalysisResponse }
    | { status: 'error'; error: Error; retry: () => void };

// AbortSignal로 unmount 시 폴링을 즉시 종료한다.
async function fetchFundamentalAnalysis(
    symbol: string,
    modelId: ModelId,
    signal: AbortSignal,
    onJobId: (jobId: string | null) => void
): Promise<FundamentalAnalysisResponse> {
    const submitted = await submitFundamentalAnalysisAction(symbol, modelId);

    if (submitted.status === 'cached') return submitted.result;
    if (submitted.status === 'error') {
        const message =
            submitted.code === 'fetch_failed'
                ? (submitted.error ?? '데이터를 불러오지 못했습니다.')
                : '사용량 한도를 초과했습니다.';
        throw new Error(message);
    }

    onJobId(submitted.jobId);
    try {
        const { jobId } = submitted;
        while (!signal.aborted) {
            await sleep(FUNDAMENTAL_NEWS_POLL_INTERVAL_MS);
            if (signal.aborted) break;
            const polled = await pollFundamentalAnalysisAction(jobId);
            if (polled.status === 'done') return polled.result;
            if (polled.status === 'error') {
                throw new Error(polled.error ?? '분석 중 오류가 발생했습니다.');
            }
        }
    } finally {
        onJobId(null);
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
            fetchFundamentalAnalysis(symbol, modelId, signal, jobId => {
                currentJobIdRef.current = jobId;
            }),
        enabled: false,
        retry: false,
        staleTime: Infinity,
    });

    const { refetch } = query;

    const retry = useCallback(() => {
        void refetch();
    }, [refetch]);

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
