import type { Timeframe } from '@y0ngha/siglens-core';
import { isExtendedBarTimeframe } from '@/shared/api/market/extendedBarsSession';
import type { MarketProfileId } from '@/shared/config/marketProfile/types';

/** `isExtendedBarsFetchEnabled`가 보는 입력 — 훅이 렌더마다 모아 넘긴다. */
export interface ExtendedBarsGate {
    marketProfile: MarketProfileId;
    timeframe: Timeframe;
    toggledOn: boolean;
    humanInteracted: boolean;
}

/**
 * 확장 봉을 **조회해도 되는가**. 모두 만족해야 한다(하나라도 아니면 Server Action을 부르지 않는다).
 * `useExtendedBars`가 쿼리 활성 여부와 캐시 값 노출 여부 두 곳에서 쓴다.
 *
 * - 미국 주식(us-equity)만 — 크립토는 24/7이라 세션이 없고, 한국 주식은 소스(yahoo)가 다르다.
 * - 인트라데이만 — 일봉 엔드포인트는 `extended`를 무시한다.
 * - 토글이 켜져 있다.
 * - `humanInteracted` — 이 탭에서 신뢰 입력이 있었다. 렌더만 하고 떠나는 크롤러가 인트라데이
 *   URL(`?timeframe=5Min`)을 열어도 확장 봉 요청은 나가지 않는다(FMP 대역폭 보호; 정규장 봉은
 *   기존 경로가 그대로 받는다). 타임프레임 버튼·키보드·터치는 모두 신뢰 입력이라 사람이 쓰는 흐름은
 *   막히지 않는다. SSR·ISR은 이 훅이 돌지 않는다(`useQuery`는 서버에서 fetch하지 않는다).
 */
export function isExtendedBarsFetchEnabled({
    marketProfile,
    timeframe,
    toggledOn,
    humanInteracted,
}: ExtendedBarsGate): boolean {
    return (
        marketProfile === 'us-equity' &&
        isExtendedBarTimeframe(timeframe) &&
        toggledOn &&
        humanInteracted
    );
}
