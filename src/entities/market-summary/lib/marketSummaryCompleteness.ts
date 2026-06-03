import type { MarketSummaryData } from '@y0ngha/siglens-core';

/**
 * 시장 요약 번들의 quote 완전성 판정 — 서버 캐시 가드와 클라이언트 안내 표시가
 * **반드시 동일한 기준**으로 동작하도록 단일 source로 둔다.
 *
 * 배경: `getMarketSummary`(core)는 심볼별 FMP quote를 병렬로 가져오고, 개별 호출이
 * 실패하면 해당 종목의 `price`/`changesPercentage`를 0으로 default한다(대시보드가
 * 일부 종목 실패에도 통째로 깨지지 않도록). 따라서 **price === 0 은 "그 심볼 fetch
 * 실패"의 신호**다(정상 시세가 정확히 0인 지수/ETF는 없음).
 *
 * 캐시 레이어는 0이 섞인 번들을 저장하지 않아 transient 실패가 TTL(장외 최대 24h)
 * 동안 굳지 않게 하고, 클라이언트는 같은 조건에서 "데이터 일부 로드 실패" 안내를
 * 띄운다 — 두 조건이 어긋나면 "캐시는 안 됐는데 안내는 안 뜨는" 모순이 생기므로
 * 한 곳에서 정의한다.
 */
export function hasMissingQuotes(summary: MarketSummaryData): boolean {
    return (
        summary.indices.some(q => q.price === 0) ||
        summary.sectors.some(q => q.price === 0)
    );
}

/**
 * `hasMissingQuotes`의 역 — 전 지수·섹터가 실제(0이 아닌) 시세를 반환했을 때만 true.
 * Redis 캐시 쓰기 가드로 사용한다(부분/전면 실패 번들은 캐싱하지 않음).
 */
export function allQuotesPresent(summary: MarketSummaryData): boolean {
    return !hasMissingQuotes(summary);
}
