/**
 * 마켓 뉴스 카드의 티커 칩 모델.
 */
import type { NewsFeedCategoryId } from '@/entities/market-news/lib/categoryConfig';
import { isCuratedSymbol } from '@/entities/symbol-indexability/lib/isCuratedSymbol';

/** 칩 하나의 표시 모델. `href`가 있으면 링크 칩, `null`이면 링크 없는 텍스트 칩이다. */
export interface TickerChipModel {
    ticker: string;
    href: string | null;
}

/**
 * 티커 목록을 칩 모델로 바꾼다.
 *
 * `stock` 카테고리의 **큐레이션된** 티커만 `/${ticker}/news`(색인되는 뉴스 탭)로 링크한다.
 * 큐레이션 밖 티커의 페이지는 noindex 롱테일이라 링크가 크롤 예산만 쓰고, 암호화폐
 * 센티널(`BTCUSD` 등)은 종목 페이지 자체가 없다.
 */
export function buildTickerChips(
    category: NewsFeedCategoryId,
    tickers: readonly string[]
): TickerChipModel[] {
    return tickers.map(ticker => {
        const linkable = category === 'stock' && isCuratedSymbol(ticker);
        return { ticker, href: linkable ? `/${ticker}/news` : null };
    });
}
