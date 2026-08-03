import type {
    NewsAnalysisResponse,
    NewsFeedCategory,
} from '@y0ngha/siglens-core';
import {
    submitMarketNewsDigestAction,
    type SubmitMarketNewsDigestActionResult,
} from '@/entities/market-news/actions';

/**
 * run* 함수는 블로킹으로 결과를 반환하므로 poll 루프가 필요 없다.
 * `done`은 `cached`와 동일하게 `result`를 반환한다.
 */
export async function fetchMarketNewsDigest(
    category: NewsFeedCategory
): Promise<NewsAnalysisResponse> {
    const result: SubmitMarketNewsDigestActionResult =
        await submitMarketNewsDigestAction(category);

    if (result.status === 'error') {
        throw new Error(result.error);
    }
    if (result.status === 'cached' || result.status === 'done')
        return result.result;
    if (result.status === 'miss_no_trigger') {
        throw new Error(
            '다이제스트를 생성할 수 없어요. 잠시 후 다시 시도해 주세요.'
        );
    }
    if (result.status === 'no_news') {
        throw new Error('분석할 뉴스가 없어요. 잠시 후 다시 시도해 주세요.');
    }
    throw new Error('예상치 못한 오류가 발생했습니다.');
}
