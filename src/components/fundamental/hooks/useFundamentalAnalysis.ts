'use client';

import { useSuspenseQuery } from '@tanstack/react-query';
import type {
    FundamentalAnalysisResponse,
    ModelId,
} from '@y0ngha/siglens-core';
import { submitFundamentalAnalysisAction } from '@/infrastructure/market/submitFundamentalAnalysisAction';
import { pollFundamentalAnalysisAction } from '@/infrastructure/market/pollFundamentalAnalysisAction';
import { sleep } from '@/components/symbol-page/utils/sleep';
import { QUERY_KEYS } from '@/lib/queryConfig';
import { FUNDAMENTAL_NEWS_POLL_INTERVAL_MS } from '@/infrastructure/market/pollingConfig';

async function fetchFundamentalAnalysis(
    symbol: string,
    modelId: ModelId
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

    const { jobId } = submitted;
    while (true) {
        await sleep(FUNDAMENTAL_NEWS_POLL_INTERVAL_MS);
        const polled = await pollFundamentalAnalysisAction(jobId);
        if (polled.status === 'done') return polled.result;
        if (polled.status === 'error') {
            throw new Error(polled.error ?? '분석 중 오류가 발생했습니다.');
        }
    }
}

export function useFundamentalAnalysis(
    symbol: string,
    modelId: ModelId
): FundamentalAnalysisResponse {
    const { data } = useSuspenseQuery({
        queryKey: QUERY_KEYS.fundamentalAnalysis(symbol, modelId),
        queryFn: () => fetchFundamentalAnalysis(symbol, modelId),
    });
    return data;
}
