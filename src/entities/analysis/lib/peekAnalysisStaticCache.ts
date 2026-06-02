import { unstable_cache } from 'next/cache';
import {
    peekAnalysisCache,
    type AnalysisResponse,
    type ModelId,
    type Timeframe,
} from '@y0ngha/siglens-core';

/**
 * ISR static-safe peek of the cached technical analysis. `peekAnalysisCache`(redis 읽기
 * 전용 — enqueue/생성 없음)를 Next data cache로 감싸 static generate가 redis no-store
 * fetch에 막히지 않게 한다. 종목당 캐시이며 revalidate=1h로 주기 갱신한다.
 *
 * 왜 정적화하는가: 차트 page는 SSR에서 cold cache를 peek해 봇에게 초기 분석을 노출한다.
 * static gen 중 redis no-store fetch가 `DYNAMIC_SERVER_USAGE`를 throw하면 `.catch(()=>null)`로
 * 삼키는 것은 semantically wrong(제어 흐름 에러를 read 실패로 오인)하고 fragile하다. 데이터
 * 호출 자체를 `unstable_cache`로 감싸 정적화하고, 호출부의 `.catch(()=>null)`은 genuine read
 * 실패(provider 부재/네트워크) degrade용으로 유지한다.
 *
 * 전제(축 0): root layout cookies() 제거가 선결돼야 정적화가 유효하다(Task 2).
 *
 * 키: ticker + timeframe + fmpSymbol + modelId. (참고: peek의 cache 키 자체는 fmpSymbol을
 * 쓰지 않지만, 시그니처 정렬과 향후 키 분리를 위해 unstable_cache 키에 포함한다.)
 */
export function peekAnalysisStatic(
    ticker: string,
    timeframe: Timeframe,
    fmpSymbol: string | undefined,
    modelId: ModelId
): Promise<AnalysisResponse | null> {
    return unstable_cache(
        () => peekAnalysisCache(ticker, timeframe, fmpSymbol, modelId),
        ['peek-analysis-static', ticker, timeframe, fmpSymbol ?? '', modelId],
        { revalidate: 3600, tags: [`symbol:${ticker}`] }
    )();
}
