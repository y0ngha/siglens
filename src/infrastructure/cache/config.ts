import type { Timeframe } from '@/domain/types';
import {
    SECONDS_PER_MINUTE,
    SECONDS_PER_HOUR,
    SECONDS_PER_DAY,
    SECONDS_PER_YEAR,
    MS_PER_SECOND,
    MS_PER_HOUR,
    MS_PER_DAY,
} from '@/domain/constants/time';

export const ANALYSIS_CACHE_TTL: Record<Timeframe, number> = {
    '1Min': 5 * SECONDS_PER_MINUTE,
    '5Min': 15 * SECONDS_PER_MINUTE,
    '15Min': 30 * SECONDS_PER_MINUTE,
    '1Hour': SECONDS_PER_HOUR,
    '1Day': SECONDS_PER_DAY,
};

export const TICKER_SEARCH_CACHE_TTL = SECONDS_PER_DAY;

// 한국어 이름 매핑은 장기 보존 (1년). sync 스크립트로 주기적 갱신.
export const KOREAN_NAMES_CACHE_TTL = SECONDS_PER_YEAR;

// 한국어 회사명 없음: 번역 대기 상태 → 12시간 후 재시도 가능하도록 단기 보존
export const ASSET_INFO_CACHE_TTL_WITHOUT_KOREAN = 12 * SECONDS_PER_HOUR;
// 한국어 회사명 있음: 완성된 데이터 → 1년 장기 보존
export const ASSET_INFO_CACHE_TTL_WITH_KOREAN = SECONDS_PER_YEAR;

export const KOREAN_TICKERS_CACHE_KEY = 'korean:tickers';

export const CACHE_EXPIRY_HOUR_KST = 17;
const KST_OFFSET_HOURS = 9;

export function computeSecondsUntilKst17(now: Date): number {
    const nowMs = now.getTime();
    const kstMs = nowMs + KST_OFFSET_HOURS * MS_PER_HOUR;
    const kstDate = new Date(kstMs);

    const todayKst17 = new Date(
        Date.UTC(
            kstDate.getUTCFullYear(),
            kstDate.getUTCMonth(),
            kstDate.getUTCDate(),
            CACHE_EXPIRY_HOUR_KST - KST_OFFSET_HOURS,
            0,
            0,
            0
        )
    );

    const kst17Ms = todayKst17.getTime();
    const targetMs = nowMs < kst17Ms ? kst17Ms : kst17Ms + MS_PER_DAY;

    return Math.floor((targetMs - nowMs) / MS_PER_SECOND);
}

export function computeEffectiveTtl(timeframe: Timeframe, now: Date): number {
    return Math.min(
        ANALYSIS_CACHE_TTL[timeframe],
        computeSecondsUntilKst17(now)
    );
}

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
