/**
 * 동종 업체 표의 행 모델 — 링크 가능 여부 판정을 UI 밖으로 뺀다.
 */
import type { FundamentalPeerInput } from '@y0ngha/siglens-core';
import { isCuratedSymbol } from '@/entities/symbol-indexability/lib/isCuratedSymbol';

/** 표 한 행. `linkable`이 거짓이면 심볼을 링크 없는 텍스트로 그린다. */
export interface PeerRow {
    symbol: string;
    companyName: string;
    marketCap: number;
    linkable: boolean;
}

/**
 * peer 목록을 행으로 바꾼다. 큐레이션 밖 티커의 차트 페이지는 항상 noindex라 링크는 크롤
 * 예산만 쓴다 — 큐레이션 peer만 `linkable`이다.
 */
export function buildPeerRows(
    peers: readonly FundamentalPeerInput[]
): PeerRow[] {
    return peers.map(({ symbol, companyName, marketCap }) => ({
        symbol,
        companyName,
        marketCap,
        linkable: isCuratedSymbol(symbol),
    }));
}
