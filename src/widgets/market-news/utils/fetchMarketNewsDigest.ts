import type {
    NewsAnalysisResponse,
    NewsFeedCategory,
} from '@y0ngha/siglens-core';
import type { SubmitMarketNewsDigestActionResult } from '@/entities/market-news/actions';
import { runAnalysisStream } from '@/shared/hooks/useAnalysisStream';

/**
 * 다이제스트를 SSE 한 연결로 받아온다. `done`은 `cached`와 동일하게 `result`를 반환한다.
 *
 * 서버 액션을 직접 부르지 않는 이유 — 액션도 결국 단일 POST이고, LLM을 기다리는 동안
 * 바이트가 흐르지 않아 ALB `idle_timeout` 60초에 잘린다(실측: 침묵 61.1초 절단,
 * 25~30초 heartbeat면 286초까지 완주).
 *
 * `signal`은 react-query가 넘겨준다 — 쿼리가 취소되면 fetch가 끊기고, 라우트가 그
 * 신호를 core에 전달해 진행 중인 LLM 호출까지 취소한다.
 */
export async function fetchMarketNewsDigest(
    category: NewsFeedCategory,
    signal?: AbortSignal
): Promise<NewsAnalysisResponse> {
    const result = await runAnalysisStream<SubmitMarketNewsDigestActionResult>({
        type: 'marketNewsDigest',
        params: { category },
        signal,
    });

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
