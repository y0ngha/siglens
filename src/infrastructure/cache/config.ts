import type { Timeframe } from '@/domain/types';

export const ANALYSIS_CACHE_TTL: Record<Timeframe, number> = {
    '1Min': 5 * 60,
    '5Min': 15 * 60,
    '15Min': 30 * 60,
    '1Hour': 60 * 60,
    '1Day': 24 * 60 * 60,
};

export const TICKER_SEARCH_CACHE_TTL = 24 * 60 * 60;

// 한국어 이름 매핑은 장기 보존 (1년). sync 스크립트로 주기적 갱신.
export const KOREAN_NAMES_CACHE_TTL = 365 * 24 * 60 * 60;

// 한국어 회사명 없음: 번역 대기 상태 → 12시간 후 재시도 가능하도록 단기 보존
export const ASSET_INFO_CACHE_TTL_WITHOUT_KOREAN = 12 * 60 * 60;
// 한국어 회사명 있음: 완성된 데이터 → 1년 장기 보존
export const ASSET_INFO_CACHE_TTL_WITH_KOREAN = 365 * 24 * 60 * 60;

export const KOREAN_TICKERS_CACHE_KEY = 'korean:tickers';

export function buildAnalysisCacheKey(
    symbol: string,
    timeframe: Timeframe
): string {
    return `analysis:${symbol}:${timeframe}`;
}

export function buildTickerSearchCacheKey(query: string): string {
    return `ticker:search:${query.toLowerCase()}`;
}

export function buildAssetInfoCacheKey(symbol: string): string {
    return `asset-info:${symbol.toUpperCase()}`;
}
