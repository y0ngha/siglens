import { notFound } from 'next/navigation';
import { getAssetInfoResilient } from '@/entities/ticker/lib/getAssetInfoResilient';
import { isUnresolvableDegraded } from '@/shared/lib/symbolGuard';
import type { AssetInfo } from '@/shared/lib/types';

export interface ResolvableAsset {
    readonly assetInfo: AssetInfo;
    /** `getAssetInfoResilient`가 인프라 장애 폴백으로 푼 값인가. */
    readonly degraded: boolean;
}

/**
 * `[symbol]` 라우트의 **심볼 존재 판정** — 레이아웃과 모든 탭의 `generateMetadata`가
 * 같은 함수를 부른다.
 *
 * 레이아웃만 `notFound()`를 던지고 `generateMetadata`는 `!assetInfo`를 noindex
 * 메타데이터로 돌려주던 시절에는, 존재하지 않는 심볼이 **404 응답인데 제목은
 * 티커 이름을 단 정상 페이지 제목**(`INVALIDTICKER1 기술적 분석 …`)이 됐다 —
 * 404 UI 위에 정상 페이지의 `<title>`·`og:*`가 얹힌 모양이다. 메타데이터도 같은
 * 판정으로 `notFound()`를 던지면 404 경계의 제목(`[locale]/not-found.tsx`)이 쓰인다.
 *
 * `getAssetInfoResilient`는 `React.cache`라 한 요청 안에서 레이아웃·메타데이터·
 * 본문이 같은 ticker(대문자)로 부르면 한 번만 조회된다. 장애 폴백(`degraded` +
 * 형상 통과)은 종전대로 200 + noindex를 유지하므로 여기서 걸리지 않는다
 * (`isUnresolvableDegraded` JSDoc).
 *
 * `notFound()`는 던지는 함수라 반환 타입이 `never`로 좁혀져, 호출부는 `assetInfo`를
 * non-null로 받는다 — 그 아래의 `!assetInfo` 분기는 죽은 코드다.
 */
export async function requireResolvableAsset(
    ticker: string
): Promise<ResolvableAsset> {
    const { assetInfo, degraded } = await getAssetInfoResilient(ticker);
    if (isUnresolvableDegraded(ticker, degraded) || !assetInfo) notFound();
    return { assetInfo, degraded };
}
