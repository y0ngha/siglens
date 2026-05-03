'use client';

import { useSuspenseQuery } from '@tanstack/react-query';
import type { NewsAnalysisResponse, ModelId } from '@y0ngha/siglens-core';
import { submitNewsAnalysisAction } from '@/infrastructure/market/submitNewsAnalysisAction';
import { pollNewsAnalysisAction } from '@/infrastructure/market/pollNewsAnalysisAction';
import { sleep } from '@/components/symbol-page/utils/sleep';
import { QUERY_KEYS } from '@/lib/queryConfig';
import { FUNDAMENTAL_NEWS_POLL_INTERVAL_MS } from '@/infrastructure/market/pollingConfig';

// AbortSignal로 unmount 시 폴링을 즉시 종료한다.
async function fetchNewsAnalysis(
    symbol: string,
    modelId: ModelId,
    signal: AbortSignal
): Promise<NewsAnalysisResponse> {
    const submitted = await submitNewsAnalysisAction(symbol, modelId);

    if (submitted.status === 'cached') return submitted.result;
    if (submitted.status === 'error') {
        const message =
            submitted.code === 'no_news'
                ? '분석할 뉴스가 없습니다. 잠시 후 다시 시도해 주세요.'
                : '사용량 한도를 초과했습니다.';
        throw new Error(message);
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
    modelId: ModelId
): NewsAnalysisResponse {
    const { data } = useSuspenseQuery({
        queryKey: QUERY_KEYS.newsAnalysis(symbol, modelId),
        queryFn: ({ signal }) => fetchNewsAnalysis(symbol, modelId, signal),
    });
    return data;
}
