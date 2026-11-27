import { isPopularSymbol } from '@/entities/ticker/lib/searchRelevance';
import { dashboardScopeOf } from '@/shared/config/dashboardScope';

const KR_DASHBOARD_SYMBOLS: ReadonlySet<string> = new Set(
    dashboardScopeOf('kr').sectorStocks.map(stock => stock.symbol)
);

/**
 * 신호 페이지 목록에서 종목 페이지 링크를 따라가게 둘 종목인가.
 *
 * 색인하는 종목 페이지(`isPopularSymbol`: 미국 인기 종목·암호화폐와 한국 인기 20종)에 더해, 한국 대시보드
 * 목록(`/market/kr`의 섹터 스캐너가 주 대상으로 쓰는 `sectorStocks`)도 따라가게 한다. 인기 목록은 한국 종목이
 * 20개뿐이라, 이것만 기준으로 하면 코스피 200·코스닥 150 대형주 대부분의 링크가 nofollow가 된다. 대시보드
 * 목록은 이미 사이트 안에서 한국 시장의 대표 종목으로 다루는 고정된 작은 집합(20종)이라 크롤 범위가 늘지
 * 않는다. 그 밖의 스캔 대상은 색인하지 않는 종목 페이지라 nofollow다.
 *
 * 이 판정은 링크의 `rel`에만 쓴다. ItemList의 `url`은 색인 대상인 `isPopularSymbol`만 싣는다.
 */
export function isFollowedHubSymbol(symbol: string): boolean {
    return isPopularSymbol(symbol) || KR_DASHBOARD_SYMBOLS.has(symbol);
}
