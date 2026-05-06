'use client';

import { useCallback, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { NewsAnalysisResponse, ModelId } from '@y0ngha/siglens-core';
import { submitNewsAnalysisAction } from '@/infrastructure/market/submitNewsAnalysisAction';
import { pollNewsAnalysisAction } from '@/infrastructure/market/pollNewsAnalysisAction';
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
    signal: AbortSignal
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

    const { jobId } = submitted;
    while (!signal.aborted) {
        await sleep(FUNDAMENTAL_NEWS_POLL_INTERVAL_MS);
        if (signal.aborted) throw new Error('aborted');
        const polled = await pollNewsAnalysisAction(jobId);
        if (polled.status === 'done') return polled.result;
        if (polled.status === 'error') {
            throw new Error(polled.error ?? '분석 중 오류가 발생했습니다.');
        }
    }
    throw new Error('aborted');
}

export function useNewsAnalysis(
    symbol: string,
    companyName: string,
    modelId: ModelId
): NewsAnalysisState {
    const queryClient = useQueryClient();
    const queryKey = useMemo(
        () => QUERY_KEYS.newsAnalysis(symbol, modelId),
        [symbol, modelId]
    );

    const query = useQuery({
        queryKey,
        queryFn: ({ signal }) =>
            fetchNewsAnalysis(symbol, companyName, modelId, signal),
        enabled: false,
        retry: false,
        staleTime: Infinity,
    });

    const { refetch } = query;
    useEffect(() => {
        if (queryClient.getQueryData(queryKey) === undefined) {
            void refetch();
        }
    }, [queryClient, queryKey, refetch]);

    const retry = useCallback(() => {
        void refetch();
    }, [refetch]);

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
