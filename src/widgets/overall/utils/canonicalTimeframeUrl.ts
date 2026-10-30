import type { Timeframe } from '@y0ngha/siglens-core';

/**
 * 현재 주소에서 `tf`만 바꾼 주소를 만든다. 다른 쿼리 파라미터(UTM·공유 토큰 등)와
 * 해시는 그대로 둔다 — 정규화는 timeframe 하나만 고쳐야 한다.
 *
 * @param pathname 로케일 접두사가 붙은 경로(`/ja/AAPL/overall`).
 * @param search `window.location.search`.
 * @param hash `window.location.hash`.
 */
export function canonicalTimeframeUrl(
    pathname: string,
    search: string,
    hash: string,
    timeframe: Timeframe
): string {
    const params = new URLSearchParams(search);
    params.set('tf', timeframe);
    return `${pathname}?${params.toString()}${hash}`;
}
