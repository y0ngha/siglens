'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { NewsAnalysisResponse, ModelId } from '@y0ngha/siglens-core';
import { submitNewsAnalysisAction } from '@/infrastructure/market/submitNewsAnalysisAction';
import { pollNewsAnalysisAction } from '@/infrastructure/market/pollNewsAnalysisAction';
import { cancelNewsAnalysisJobAction } from '@/infrastructure/market/cancelNewsAnalysisJobAction';
import { sleep } from '@/lib/sleep';
import { QUERY_KEYS } from '@/lib/queryConfig';
import { FUNDAMENTAL_NEWS_POLL_INTERVAL_MS } from '@/lib/pollingConfig';

export type NewsAnalysisState =
    | { status: 'loading' }
    | { status: 'done'; result: NewsAnalysisResponse }
    | { status: 'error'; error: Error; retry: () => void };

// AbortSignal로 unmount 시 폴링을 즉시 종료한다.
async function fetchNewsAnalysis(
    symbol: string,
    companyName: string,
    modelId: ModelId,
    signal: AbortSignal,
    onJobId: (jobId: string | null) => void
): Promise<NewsAnalysisResponse> {
    if (signal.aborted) throw new Error('aborted');
    const submitted = await submitNewsAnalysisAction(
        symbol,
        companyName,
        modelId
    );

    if (submitted.status === 'cached') return submitted.result;
    if (submitted.status === 'error') {
        if (submitted.code === 'no_news') {
            throw new Error(
                '분석할 뉴스가 없습니다. 잠시 후 다시 시도해 주세요.'
            );
        }
        if (submitted.code === 'usage_limit_exceeded') {
            throw new Error(submitted.error.message);
        }
        throw new Error('분석 중 오류가 발생했습니다.');
    }

    onJobId(submitted.jobId);
    try {
        const { jobId } = submitted;
        while (!signal.aborted) {
            await sleep(FUNDAMENTAL_NEWS_POLL_INTERVAL_MS);
            if (signal.aborted) break;
            const polled = await pollNewsAnalysisAction(jobId);
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

export function useNewsAnalysis(
    symbol: string,
    companyName: string,
    modelId: ModelId
): NewsAnalysisState {
    const queryClient = useQueryClient();
    const currentJobIdRef = useRef<string | null>(null);
    const queryKey = useMemo(
        () => QUERY_KEYS.newsAnalysis(symbol, modelId),
        [symbol, modelId]
    );

    const query = useQuery({
        queryKey,
        queryFn: ({ signal }) =>
            fetchNewsAnalysis(symbol, companyName, modelId, signal, jobId => {
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
                void cancelNewsAnalysisJobAction(jobId).catch(error => {
                    console.warn('[useNewsAnalysis] cancel failed', error);
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
