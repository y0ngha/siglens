import { unstable_cache } from 'next/cache';
import {
    peekAnalysisCache,
    type AnalysisLocale,
    type FilteredAnalysisResult,
    type ModelId,
    type Timeframe,
} from '@y0ngha/siglens-core';
import { SECONDS_PER_QUARTER_DAY } from '@/shared/config/time';

/**
 * AI 분석 peek 정적 캐시의 revalidate. `[symbol]` 탭 revalidate clamp 가드가 이 값을 직접 읽는다.
 */
export const PEEK_ANALYSIS_STATIC_REVALIDATE_SECONDS = SECONDS_PER_QUARTER_DAY;

/**
 * 캐시된 기술적 분석을 ISR 정적 렌더에서 안전하게 peek한다. `peekAnalysisCache`(redis
 * 읽기 전용 — enqueue/생성 없음)를 Next data cache로 감싸 static generate가 redis
 * no-store fetch에 막히지 않게 한다. 종목당 캐시이며 revalidate=6h
 * (`SECONDS_PER_QUARTER_DAY`)로 차트 페이지(`[symbol]`)의 선언 revalidate(6h)와
 * 정렬한다. 기본 1h는 차트 라우트의 실효 `s-maxage`를 1h로 클램프했다(Next는 렌더 중
 * 읽은 가장 짧은 캐시 TTL을 라우트에 적용). 사용자 신선도는 클라 `useAnalysis`
 * 재요청이 책임지므로 seed TTL이 길어도 무방하다.
 *
 * 왜 정적화하는가: 차트 page는 SSR에서 cold cache를 peek해 봇에게 초기 분석을 노출한다.
 * static gen 중 redis no-store fetch가 `DYNAMIC_SERVER_USAGE`를 throw하면
 * `.catch(()=>null)`로 삼키는 것은 제어 흐름 에러를 read 실패로 오인하는 fragile한
 * 처리다. 데이터 호출 자체를 `unstable_cache`로 감싸 정적화하고, 호출부의
 * `.catch(()=>null)`은 진짜 read 실패(provider 부재/네트워크) degrade용으로 유지한다.
 * root layout의 `cookies()` 제거가 선결돼야 정적화가 유효하다.
 *
 * 캐시 키: ticker(대문자 정규화 — 호출부 대소문자 혼용 시 캐시 분기 방지) + timeframe
 * + modelId + tier + locale. `fmpSymbol`은 `peekAnalysisCache`의 내부 캐시 키가 쓰지
 * 않으므로 키에서 제외한다 — 포함하면 같은 데이터가 fmpSymbol 유무로 중복 저장된다.
 * 시그니처 정렬을 위해 인자로는 받아 그대로 전달한다.
 *
 * `benchmarkSymbol`은 writer가 `runAnalysis`에 넘긴 `benchmark.symbol`이다(`benchmarkFor`). core가 이를 캐시 키
 * (`:bm=`)에 접으므로 어긋나면 항상 미스이고, 종목의 시장이 바뀌면 다른 항목이라 `unstable_cache` 키에도 넣는다.
 *
 * 아래 세 값은 항상 상수라 `unstable_cache` 키에 넣지 않는다. 이 peek은 익명/봇
 * 방문자가 보는 초기 셸이고, 그 writer(익명·free 방문자의 SSE 분석 요청)가 쓰는 키에
 * 맞춰야 HIT하기 때문이다. 회원이 받은 결과가 익명 peek에 섞이면 캐시 오염이다
 * (회원은 클라 재요청으로 자기 값을 받는다).
 * - `reasoning`: `false` — writer는 reasoning-OFF 키를 쓴다.
 * - `tier`: `'free'`.
 * - `positionBucket`: no-bucket(`undefined`) — `resolveHoldingPositionBucket`이 free
 *   tier·미로그인 호출자에게 절대 버킷을 부여하지 않으므로 writer 키는 항상 no-bucket이다.
 *
 * `locale`은 호출부(페이지)가 해석한 요청 로케일을 그대로 넘긴다. writer가 `locale`을
 * core 캐시 키에 접으므로, 생략하면 항상 `ko` 키를 읽어 non-ko 페이지가 한국어 캐시
 * 항목을 봇에게 노출하거나 항상 미스만 낸다. 로케일마다 다른 항목을 읽으므로
 * `unstable_cache` 키에도 포함한다.
 */
export function peekAnalysisStatic(
    ticker: string,
    timeframe: Timeframe,
    fmpSymbol: string | undefined,
    modelId: ModelId,
    locale: AnalysisLocale,
    benchmarkSymbol: string | undefined
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
                undefined,
                locale,
                { benchmarkSymbol }
            ),
        [
            'peek-analysis-static',
            upper,
            timeframe,
            modelId,
            'free',
            locale,
            benchmarkSymbol ?? 'none',
        ],
        {
            revalidate: PEEK_ANALYSIS_STATIC_REVALIDATE_SECONDS,
            tags: [`symbol:${upper}`],
        }
    )();
}
