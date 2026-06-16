import type {
    NewsAnalysisResponse,
    NewsFeedCategory,
} from '@y0ngha/siglens-core';
import {
    submitMarketNewsDigestAction,
    pollMarketNewsDigestAction,
    cancelMarketNewsDigestAction,
    type SubmitMarketNewsDigestActionResult,
} from '@/entities/market-news/actions';
import { sleep } from '@/shared/lib/sleep';
import { ANALYSIS_POLL_INTERVAL_MS } from '@/shared/config/pollingConfig';

export async function fetchMarketNewsDigest(
    category: NewsFeedCategory,
    signal: AbortSignal,
    onJobId: (jobId: string | null, expectedCurrent?: string | null) => void
): Promise<NewsAnalysisResponse> {
    if (signal.aborted) throw new Error('aborted');

    const submitted: SubmitMarketNewsDigestActionResult =
        await submitMarketNewsDigestAction(category);

    if (submitted.status === 'error') {
        throw new Error(submitted.error);
    }
    if (submitted.status === 'cached') return submitted.result;
    if (submitted.status === 'miss_no_trigger') {
        throw new Error(
            '다이제스트를 생성할 수 없어요. 잠시 후 다시 시도해 주세요.'
        );
    }
    if (submitted.status === 'no_news') {
        throw new Error('분석할 뉴스가 없어요. 잠시 후 다시 시도해 주세요.');
    }

    // submitted.status === 'submitted'
    onJobId(submitted.jobId);
    try {
        const { jobId } = submitted;
        while (!signal.aborted) {
            await sleep(ANALYSIS_POLL_INTERVAL_MS);
            if (signal.aborted) break;
            const polled = await pollMarketNewsDigestAction(jobId);
            if (polled.status === 'done') return polled.result;
            if (polled.status === 'error') {
                throw new Error(
                    polled.error ?? 'AI 다이제스트 생성 중 오류가 발생했어요.'
                );
            }
        }
    } finally {
        // Only clear the ref if this execution's jobId is still the current one.
        onJobId(null, submitted.jobId);
    }
    throw new Error('aborted');
}

export { cancelMarketNewsDigestAction };
