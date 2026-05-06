'use client';

import { useSuspenseQuery } from '@tanstack/react-query';
import type { NewsAnalysisResponse, ModelId } from '@y0ngha/siglens-core';
import { submitNewsAnalysisAction } from '@/infrastructure/market/submitNewsAnalysisAction';
import { pollNewsAnalysisAction } from '@/infrastructure/market/pollNewsAnalysisAction';
import { sleep } from '@/lib/sleep';
import { QUERY_KEYS } from '@/lib/queryConfig';
import { FUNDAMENTAL_NEWS_POLL_INTERVAL_MS } from '@/lib/pollingConfig';

// AbortSignal로 unmount 시 폴링을 즉시 종료한다.
async function fetchNewsAnalysis(
    symbol: string,
    companyName: string,
    modelId: ModelId,
    signal: AbortSignal
): Promise<NewsAnalysisResponse> {
    // Next.js Server Action 호출이 Router pending 상태를 업데이트하는데,
    // useSuspenseQuery suspend 중에 이 업데이트가 발생하면
    // "Cannot update Router while rendering" 경고가 발생한다.
    // 마이크로태스크 한 틱을 yield해 현재 렌더 사이클이 끝난 뒤 Action이 호출되도록 보장.
    await Promise.resolve();
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
): NewsAnalysisResponse {
    const { data } = useSuspenseQuery({
        queryKey: QUERY_KEYS.newsAnalysis(symbol, modelId),
        queryFn: ({ signal }) =>
            fetchNewsAnalysis(symbol, companyName, modelId, signal),
    });
    return data;
}
