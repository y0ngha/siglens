import {
    SECONDS_PER_DAY,
    SECONDS_PER_HOUR,
    SECONDS_PER_YEAR,
} from '@/shared/config/time';

/** 티커 검색 결과: 하루 캐시 */
export const TICKER_SEARCH_CACHE_TTL = SECONDS_PER_DAY;

/** 한국어 미보유: 번역 대기 → 12시간 후 재시도 가능하도록 단기 보존 */
export const ASSET_INFO_HOURS_WITHOUT_KOREAN = 12;
/** 한국어 미보유 자산정보 캐시 TTL (초). */
export const ASSET_INFO_CACHE_TTL_WITHOUT_KOREAN =
    ASSET_INFO_HOURS_WITHOUT_KOREAN * SECONDS_PER_HOUR;
/** 한국어 보유: 완성된 데이터 → 1년 장기 보존 */
export const ASSET_INFO_CACHE_TTL_WITH_KOREAN = SECONDS_PER_YEAR;

/** 한국어 이름 매핑: 장기 보존 (sync 스크립트로 주기 갱신) */
export const KOREAN_NAMES_CACHE_TTL = SECONDS_PER_YEAR;

/** 한국어 티커 캐시 키 (전체 매핑 한 번에 보관). */
export const KOREAN_TICKERS_CACHE_KEY = 'korean:tickers';

/** FMP cryptocurrency-list membership cache key. */
export const CRYPTO_FMP_LIST_CACHE_KEY = 'crypto:fmp-list';

export function buildTickerSearchCacheKey(query: string): string {
    return `ticker:search:${query.toLowerCase()}`;
}

export function buildAssetInfoCacheKey(symbol: string): string {
    return `asset-info:${symbol.toUpperCase()}`;
}
