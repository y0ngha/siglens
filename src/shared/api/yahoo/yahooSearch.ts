import 'server-only';
import { createYahooClient } from './createYahooClient';

// 설정 근거는 YahooMarketProvider / YahooOptionsAdapter 주석 참조.
const yahooFinance = createYahooClient();

/** yahoo `search`가 돌려주는 quote 항목 중 이 앱이 소비하는 부분집합. */
export interface YahooSearchQuote {
    symbol: string;
    shortname?: string;
    longname?: string;
    exchange?: string;
    quoteType?: string;
}

const SEARCH_QUOTES_COUNT = 10;

/**
 * yahoo 심볼 검색. 뉴스는 요청하지 않는다 — 한국 종목을 조회해도 무관한 미국 뉴스가
 * 돌아오는 것이 실측으로 확인됐고(2026-08-16), 응답만 무거워진다.
 *
 * 실패 시 빈 배열로 degrade한다. 검색은 보조 경로이므로 한 소스의 장애가 다른 소스의
 * 결과까지 없애면 안 된다(`searchTicker`가 여러 소스를 병렬로 합친다).
 */
export async function searchYahooQuotes(
    query: string
): Promise<YahooSearchQuote[]> {
    try {
        const result = await yahooFinance.search(query, {
            quotesCount: SEARCH_QUOTES_COUNT,
            newsCount: 0,
        });
        // Safe cast: `search`의 quotes는 자산군별(주식/ETF/크립토/펀드) 유니온이라
        // 공통 부분집합만 쓰는 우리 타입과 구조적으로 대응하지 않는다.
        // `YahooSearchQuote`는 `symbol`을 제외한 모든 필드를 optional로 두고,
        // 호출부가 `isKrEquitySymbol`로 형상을 다시 검증한 뒤에만 사용한다.
        return result.quotes as unknown as YahooSearchQuote[];
    } catch (e) {
        console.warn('[yahooSearch] search failed', query, e);
        return [];
    }
}
