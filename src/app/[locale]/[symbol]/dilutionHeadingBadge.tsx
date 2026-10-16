import type { ReactElement } from 'react';
import { getRecentDilutionEvent } from '@/entities/investor-flows/server/getRecentDilutionEvent';
import { classifyAsset } from '@/entities/ticker/lib/assetClassification';
import { marketProfileOf } from '@/shared/config/marketProfile/registry';
import type { AssetInfo } from '@/shared/lib/types';
import { DilutionRiskBadge } from '@/views/symbol/DilutionRiskBadge';

/**
 * 차트 탭 헤더의 증자·희석 배지를 서버에서 판정·렌더한다. 사건이 없거나 대상이 아니면 `undefined`(배지도 자리도 없음).
 *
 * - 대상은 미국 개별 주식뿐이다 — 한국·크립토는 SEC 증자 공시가 없고, ETF·지수는 "희석"의 의미가 다르다. 대상이 아니면
 *   조회 자체를 하지 않는다.
 * - 조회 실패는 로더가 `null`로 삼킨다(배지 없음 — 페이지를 깨거나 noindex로 돌리지 않는다).
 * - 로더의 캐시는 12h라 이 탭(6h)의 revalidate를 끌어내리지 않는다(`symbolTabRevalidateClamp.test.ts`).
 *
 * 엘리먼트를 돌려주는 이유: 페이지가 이걸 `SymbolPageClient`의 `headingBadge`로 넘기면 첫 HTML에 이미 박혀 있어,
 * 하이드레이션 뒤 끼어들며 헤더를 미는 일이 없다.
 *
 * @param ticker 대문자 티커
 */
export async function loadDilutionHeadingBadge(
    ticker: string,
    assetInfo: AssetInfo
): Promise<ReactElement | undefined> {
    if (marketProfileOf(assetInfo) !== 'us-equity') return undefined;
    if (classifyAsset(ticker, assetInfo.fmpSymbol, assetInfo.name) !== 'stock')
        return undefined;
    const event = await getRecentDilutionEvent(ticker);
    if (event === null) return undefined;
    return <DilutionRiskBadge symbol={ticker} event={event} />;
}
