'use client';

import { useSuspenseQuery } from '@tanstack/react-query';
import type { NewsAnalysisResponse, ModelId } from '@y0ngha/siglens-core';
import { submitNewsAnalysisAction } from '@/infrastructure/market/submitNewsAnalysisAction';
import { pollNewsAnalysisAction } from '@/infrastructure/market/pollNewsAnalysisAction';
import { sleep } from '@/lib/sleep';
import { QUERY_KEYS } from '@/lib/queryConfig';
import { AUGMENT_AND_OVERALL_POLL_INTERVAL_MS } from '@/lib/pollingConfig';

// `null` is returned for the no-news case so the consumer can render nothing without throwing.
// AbortSignal로 unmount 시 폴링을 즉시 종료한다.
async function fetchNewsAugment(
    symbol: string,
    modelId: ModelId,
    signal: AbortSignal
): Promise<NewsAnalysisResponse | null> {
    const submitted = await submitNewsAnalysisAction(symbol, modelId);

    if (submitted.status === 'cached') return submitted.result;
    if (submitted.status === 'error') {
        if (submitted.code === 'no_news') return null;
        throw new Error(
            typeof submitted.error === 'string'
                ? submitted.error
                : '뉴스 분석 요청 중 오류가 발생했습니다.'
        );
    }

    const { jobId } = submitted;
    while (!signal.aborted) {
        await sleep(AUGMENT_AND_OVERALL_POLL_INTERVAL_MS);
        if (signal.aborted) throw new Error('aborted');
        const polled = await pollNewsAnalysisAction(jobId);
        if (polled.status === 'done') return polled.result;
        if (polled.status === 'error') {
            throw new Error(
                polled.error ?? '뉴스 분석 중 오류가 발생했습니다.'
            );
        }
    }
    throw new Error('aborted');
}

export function useNewsAugment(
    symbol: string,
    modelId: ModelId
): NewsAnalysisResponse | null {
    const { data } = useSuspenseQuery({
        queryKey: QUERY_KEYS.newsAugment(symbol, modelId),
        queryFn: ({ signal }) => fetchNewsAugment(symbol, modelId, signal),
    });
    return data;
}
