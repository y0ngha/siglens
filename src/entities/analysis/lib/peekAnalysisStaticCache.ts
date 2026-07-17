import { unstable_cache } from 'next/cache';
import {
    peekAnalysisCache,
    type FilteredAnalysisResult,
    type ModelId,
    type Timeframe,
} from '@y0ngha/siglens-core';
import { SECONDS_PER_QUARTER_DAY } from '@/shared/config/time';

/**
 * ISR static-safe peek of the cached technical analysis. `peekAnalysisCache`(redis 읽기
 * 전용 — enqueue/생성 없음)를 Next data cache로 감싸 static generate가 redis no-store
 * fetch에 막히지 않게 한다. 종목당 캐시이며 revalidate=6h(`SECONDS_PER_QUARTER_DAY`)로 차트
 * 페이지(`[symbol]`)의 선언 revalidate(6h)와 정렬한다. 기본 1h는 차트 라우트의 실효
 * `s-maxage`를 1h로 클램프했다(Next는 렌더 중 읽은 가장 짧은 캐시 TTL을 라우트에 적용).
 * 사용자 신선도는 클라 `useAnalysis` 재요청이 책임지므로 seed TTL이 길어도 무방하다.
 *
 * 왜 정적화하는가: 차트 page는 SSR에서 cold cache를 peek해 봇에게 초기 분석을 노출한다.
 * static gen 중 redis no-store fetch가 `DYNAMIC_SERVER_USAGE`를 throw하면 `.catch(()=>null)`로
 * 삼키는 것은 semantically wrong(제어 흐름 에러를 read 실패로 오인)하고 fragile하다. 데이터
 * 호출 자체를 `unstable_cache`로 감싸 정적화하고, 호출부의 `.catch(()=>null)`은 genuine read
 * 실패(provider 부재/네트워크) degrade용으로 유지한다.
 *
 * 전제(축 0): root layout cookies() 제거가 선결돼야 정적화가 유효하다.
 *
 * ticker는 대문자로 정규화해 unstable_cache 키·태그를 canonical하게 유지한다(호출부 대소문자
 * 혼용 시 캐시 분기 방지). 키: ticker + timeframe + modelId + tier. fmpSymbol은 peekAnalysisCache의
 * 내부 cache 키가 쓰지 않으므로 unstable_cache 키에서 제외한다 — 포함하면 같은 데이터가
 * fmpSymbol 유무로 중복 엔트리에 저장된다. 시그니처 정렬을 위해 인자로는 받아 그대로 전달한다.
 *
 * reasoning은 항상 `false`로 고정한다(member-reasoning-toggle spec Part A.4) — 이 SSR peek은
 * 익명/봇 방문자가 보는 초기 셸이므로, writer(익명·free 방문자의 submitAnalysisAction)가
 * 쓰는 reasoning-OFF 키와 정렬되어야 HIT한다. 회원이 토글 ON으로 받은 결과가 이 익명 peek에
 * 섞이는 캐시 오염을 방지한다(회원은 클라 재요청으로 자기 값을 받는다). unstable_cache 키에는
 * 포함하지 않는다 — 항상 상수이므로 별도 분기가 필요 없다.
 *
 * positionBucket도 동일 이유로 항상 no-bucket(`undefined`)으로 고정한다
 * (personalized-analysis-by-position-bucket spec, Subsystem C). 이 익명 peek의 writer는
 * 익명/봇 방문자의 submitAnalysisAction이며, `resolveHoldingPositionBucket`이 free tier·
 * 미로그인 호출자에게 절대 버킷을 부여하지 않으므로(자기 자신도 free tier로 고정) 그 writer가
 * 쓰는 키는 항상 no-bucket이다. 회원이 자신의 포지션으로 개인화된 결과를 받는 것은 클라
 * 재요청(useAnalysis의 holding-change effect)의 몫이며, 이 SSR peek에 섞이면 안 된다.
 * unstable_cache 키에는 포함하지 않는다 — 항상 상수이므로 별도 분기가 필요 없다.
 */
export function peekAnalysisStatic(
    ticker: string,
    timeframe: Timeframe,
    fmpSymbol: string | undefined,
    modelId: ModelId
): Promise<FilteredAnalysisResult | null> {
    const upper = ticker.toUpperCase();
    return unstable_cache(
        () =>
            peekAnalysisCache(
                upper,
                timeframe,
                fmpSymbol,
                modelId,
                false,
                'free',
                undefined,
                undefined
            ),
        ['peek-analysis-static', upper, timeframe, modelId, 'free'],
        { revalidate: SECONDS_PER_QUARTER_DAY, tags: [`symbol:${upper}`] }
    )();
}
