import type { AssetInfo } from '@/shared/lib/types';
import { isDynamicServerError } from '@/shared/lib/isDynamicServerError';
import { isE2E } from '@/shared/api/e2eEnv';
import { getAssetInfoStatic } from './getAssetInfoStatic';

export interface ResilientAssetInfo {
    /** 정상 AssetInfo, 인프라 실패 시 fallback ticker 객체, 또는 실재하지 않는 종목일 때 null. */
    assetInfo: AssetInfo | null;
    /**
     * true = 인프라 실패로 fallback degrade됨. 이때는 FMP를 못 물어봐 종목의 실재
     * 여부를 알 수 없으므로(가짜 티커일 수도), 호출부의 generateMetadata가 noindex로
     * 응답해 검색 노출을 막는다. body는 그대로 fallback을 렌더해 정상 종목의 UX를 유지한다.
     */
    degraded: boolean;
}

/**
 * `getAssetInfoStatic`의 graceful 래퍼. `getAssetInfo`는 네 가지로 끝난다:
 *   - AssetInfo 반환         → `{ assetInfo, degraded: false }`(정상, ISR 캐시 대상).
 *   - null 반환              → FMP 200 + 빈 결과 = 실재하지 않는 종목. `{ assetInfo: null }`로
 *                              통과시켜 호출부의 `notFound()`(404)가 동작하게 한다.
 *   - DYNAMIC_SERVER_USAGE throw → Next.js 제어 흐름 에러이므로 그대로 rethrow한다.
 *                              인프라 실패로 오인 시 불필요한 에러 로그 + fallback degrade가 발생한다.
 *   - 기타 throw             → FMP 인프라 일시 실패(throwOnInfraFailure). 여기서 흡수해
 *                              `{symbol, name: ticker}` fallback으로 degrade하고 `degraded: true`로
 *                              표시해 호출부 generateMetadata가 noindex 처리하게 한다.
 *
 * fallback 객체는 symbol/name만 채운다. fmpSymbol은 생략하는데, AssetInfo에서
 * 이미 optional("일반 주식은 undefined")이라 다운스트림(getBarsAction/peekAnalysisCache)이
 * symbol로 degrade하는 기존 정상 경로와 동일하다. koreanName 생략 시 표시명이 영문 ticker.
 *
 * ISR 정적화: inner 데이터 호출을 `getAssetInfoStatic`(=unstable_cache(getAssetInfo))으로
 * 정적화해 static gen 중 redis no-store fetch가 `DYNAMIC_SERVER_USAGE`를 throw하지 않게 한다.
 *
 * degrade 응답의 캐싱(#545 connection() 제거 배경): 이 함수의 소비자는 전부 `[symbol]` ISR
 * 라우트(generateStaticParams=[])다. 과거 #545는 degrade 렌더가 ISR(revalidate=3600)로 1h
 * 굳지 않도록 catch에서 `connection()`으로 동적화하려 했으나, ISR 라우트의 on-demand cold-gen
 * 안에서 `connection()`은 "단일 렌더 동적화"가 아니라 `DYNAMIC_SERVER_USAGE`를 throw해 cold-gen을
 * 500으로 깨뜨린다(ISR은 per-request 동적화가 불가). #545 추가 시점엔 ISR 자체가 깨져 있어(전
 * 라우트 DSU) 이 500이 가려져 있다가, Phase 0~2가 ISR을 정상화하면서 드러났다. 그래서 connection()을
 * 제거하고 degrade 렌더가 ISR로 캐시되는 것을 허용한다 — degrade는 `degraded:true`로 noindex라
 * 검색 노출 위험이 없고, 다음 revalidate(또는 데이터 갱신 시 on-demand 무효화)에 인프라가 복구돼
 * 있으면 정상 데이터로 자동 갱신된다. 500(깨진 페이지)보다 degraded 200(noindex, fallback UX)이 낫다.
 */
export async function getAssetInfoResilient(
    ticker: string
): Promise<ResilientAssetInfo> {
    try {
        return { assetInfo: await getAssetInfoStatic(ticker), degraded: false };
    } catch (e) {
        // Next.js가 static generation / ISR 중 dynamic API를 만나면 DynamicServerError를
        // 제어 흐름 수단으로 throw한다. 이를 인프라 실패로 오인하면 불필요한 에러 로그가
        // 남고 fallback degrade 응답이 반환된다. 제어 흐름 에러는 그대로 rethrow한다.
        if (isDynamicServerError(e)) {
            throw e;
        }
        // E2E는 FMP 키가 없어 비시드 ticker마다 이 degrade가 정상적으로 발생하므로,
        // 로그가 테스트 출력을 뒤덮는다. E2E에서만 침묵시키고 프로덕션 로깅은 유지한다
        // (E2E_TEST는 프로덕션에 설정되지 않으므로 prod 동작은 그대로다).
        if (!isE2E()) {
            console.error(
                '[getAssetInfoResilient] infra failure, ticker fallback:',
                e
            );
        }
        return { assetInfo: { symbol: ticker, name: ticker }, degraded: true };
    }
}
