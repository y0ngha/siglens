import { connection } from 'next/server';
import type { AssetInfo } from '@/shared/lib/types';
import { getAssetInfoCached } from './getAssetInfoCached';

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
 * `getAssetInfoCached`의 graceful 래퍼. `getAssetInfo`는 세 가지로 끝난다:
 *   - AssetInfo 반환 → `{ assetInfo, degraded: false }`(정상, ISR 캐시 대상).
 *   - throw         → FMP 인프라 일시 실패(throwOnInfraFailure). 여기서 흡수해
 *                     `{symbol, name: ticker}` fallback으로 degrade하고, 이 degrade
 *                     응답이 ISR(revalidate=3600)로 굳지 않도록 `connection()`으로
 *                     해당 렌더만 동적화한다 — 인프라 복구 즉시 다음 요청부터 정상화.
 *                     `degraded: true`로 표시해 metadata가 noindex 처리할 수 있게 한다.
 *   - null 반환     → FMP 200 + 빈 결과 = 실재하지 않는 종목. `{ assetInfo: null }`로
 *                     통과시켜 호출부의 `notFound()`(404)가 동작하게 한다.
 *
 * fallback 객체는 symbol/name만 채운다. fmpSymbol은 생략하는데, AssetInfo에서
 * 이미 optional("일반 주식은 undefined")이라 다운스트림(getBarsAction/peekAnalysisCache)이
 * symbol로 degrade하는 기존 정상 경로와 동일하다. koreanName 생략 시 표시명이 영문 ticker.
 */
export async function getAssetInfoResilient(
    ticker: string
): Promise<ResilientAssetInfo> {
    try {
        return { assetInfo: await getAssetInfoCached(ticker), degraded: false };
    } catch (e) {
        // Next.js가 static generation / ISR 중 dynamic API를 만나면 DynamicServerError를
        // 제어 흐름 수단으로 throw한다. 이를 인프라 실패로 오인하면 불필요한 에러 로그가
        // 남고 fallback degrade 응답이 반환된다. 제어 흐름 에러는 그대로 rethrow한다.
        if (
            e instanceof Error &&
            ((e as { digest?: string }).digest === 'DYNAMIC_SERVER_USAGE' ||
                e.message.includes('Dynamic server usage'))
        ) {
            throw e;
        }
        console.error(
            '[getAssetInfoResilient] infra failure, ticker fallback:',
            e
        );
        await connection();
        return { assetInfo: { symbol: ticker, name: ticker }, degraded: true };
    }
}
