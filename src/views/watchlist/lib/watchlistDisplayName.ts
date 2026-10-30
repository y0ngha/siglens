import type { WatchlistItemView } from '@/entities/watchlist/model';

/** `useAssetLabel`이 돌려주는 조회 함수 — 카탈로그에 없으면 `fallback`을 그대로 돌려준다. */
export type AssetLabelLookup = (symbol: string, fallback: string) => string;

/**
 * 관심 항목의 표시명. 카탈로그 한글명 → 저장된 회사명 → 심볼 순이다 — 저장된 이름이 영문이라도
 * ko 화면은 한글명을 우선한다. 행 제목과 이름 순 정렬이 같은 이름을 써야 보이는 순서와 정렬이 맞는다.
 */
export function watchlistDisplayName(
    item: WatchlistItemView,
    assetLabel: AssetLabelLookup
): string {
    return assetLabel(item.symbol, item.companyName ?? item.symbol);
}
