import type { Timeframe } from '@/domain/types';

export const ANALYSIS_CACHE_TTL: Record<Timeframe, number> = {
    // TODO: 비용 문제로 인해 우선 1Day만 허용; 미사용이어도 이를 정리하지 않고 넘어간다. 나중에 사용할 예정이다.
    // '1Min': 60,
    // '5Min': 5 * 60,
    // '15Min': 15 * 60,
    // '1Hour': 60 * 60,
    '1Day': 24 * 60 * 60,
};

export const TICKER_SEARCH_CACHE_TTL = 24 * 60 * 60;

// 한국어 이름 매핑은 장기 보존 (1년). sync 스크립트로 주기적 갱신.
export const KOREAN_NAMES_CACHE_TTL = 365 * 24 * 60 * 60;

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

export const ASSET_INFO_CACHE_TTL = 24 * 60 * 60;

export function buildAssetInfoCacheKey(symbol: string): string {
    return `asset-info:${symbol.toUpperCase()}`;
}
