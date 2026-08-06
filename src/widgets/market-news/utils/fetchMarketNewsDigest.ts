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
 * `signal`은 react-query가 넘겨준다 — 쿼리가 취소되면 fetch가 끊긴다. 다만 서버 쪽
 * LLM 호출은 그대로 완주한다: 라우트가 클라이언트 signal을 core에 넘기지 않기 때문이다
 * (공유 `dedupeInFlight` promise를 남이 취소하면 안 된다 — route.ts 주석 참고).
 * 이탈한 방문자의 호출은 캐시를 채워 다음 방문자와 크롤러에게 쓰인다.
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
