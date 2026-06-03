// 슬라이스 public barrel — client-safe 순수 헬퍼만 노출한다.
// server action(getMarketSummaryAction)은 next/headers·server-only에 의존하므로
// 여기서 re-export하지 않는다(client 번들 누출 방지). 서버 소비자는
// `@/entities/market-summary/actions`에서 직접 import.
export {
    hasMissingQuotes,
    allQuotesPresent,
} from './lib/marketSummaryCompleteness';
