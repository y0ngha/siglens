import type { NewsFeedCategoryId } from '@/entities/market-news/lib/categoryConfig';
import { getMarketNewsCardsAction } from '@/entities/market-news/actions/getMarketNewsCardsAction';
import type { MarketNewsCardItem } from '@/entities/market-news/lib/toCardItem';

/**
 * 마켓 뉴스 카드 폴링 쿼리 함수. 액션의 `{ ok: false }`를 던져서 쿼리 실패로 만든다 —
 * 그래야 목록 폴러와 다이제스트 대기 폴러가 같은 쿼리(`QUERY_KEYS.marketNewsCards`)를 나눠
 * 쓰면서 연속 실패를 똑같이 센다.
 */
export async function fetchMarketNewsCards(
    category: NewsFeedCategoryId
): Promise<MarketNewsCardItem[]> {
    const result = await getMarketNewsCardsAction(category);
    if (!result.ok) throw new Error(result.error);
    return result.items;
}
