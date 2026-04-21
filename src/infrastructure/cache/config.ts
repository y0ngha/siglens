import type { Timeframe } from '@/domain/types';
import {
    KST_OFFSET_HOURS,
    MS_PER_DAY,
    MS_PER_HOUR,
    MS_PER_SECOND,
    SECONDS_PER_DAY,
    SECONDS_PER_HOUR,
    SECONDS_PER_MINUTE,
    SECONDS_PER_YEAR,
} from '@/domain/constants/time';

export const ANALYSIS_CACHE_TTL: Record<Timeframe, number> = {
    '5Min': 15 * SECONDS_PER_MINUTE,
    '15Min': 30 * SECONDS_PER_MINUTE,
    '30Min': 30 * SECONDS_PER_MINUTE,
    '1Hour': SECONDS_PER_HOUR,
    '4Hour': 4 * SECONDS_PER_HOUR,
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

// KST 17:00 = UTC 08:00 = EST 04:00 (미국 프리마켓 시작 전)
// 전날 분석 캐시를 장 시작 전에 갱신하기 위한 기준 시각
export const CACHE_EXPIRY_HOUR_KST = 17;

export function computeSecondsUntilCacheExpiry(now: Date): number {
    const kstNow = new Date(now.getTime() + KST_OFFSET_HOURS * MS_PER_HOUR);

    // 오늘 KST 17:00 설정 (kstNow는 UTC+9 오프셋이 더해진 가상 UTC 날짜)
    const kst17Today = new Date(kstNow);
    kst17Today.setUTCHours(CACHE_EXPIRY_HOUR_KST, 0, 0, 0);

    const rawDiffMs = kst17Today.getTime() - kstNow.getTime();

    // 현재 시각이 KST 17:00 이후이면 내일 17:00 기준으로 전환
    const diffMs = rawDiffMs <= 0 ? rawDiffMs + MS_PER_DAY : rawDiffMs;

    // 최소 1초를 보장하여 Redis EX 0 오류 방지
    return Math.max(1, Math.floor(diffMs / MS_PER_SECOND));
}

export function computeEffectiveTtl(timeframe: Timeframe, now: Date): number {
    return Math.min(
        ANALYSIS_CACHE_TTL[timeframe],
        computeSecondsUntilCacheExpiry(now)
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

// 시장 브리핑: 1시간 캐시 (시장 데이터 변화 주기에 맞춤)
export const MARKET_BRIEFING_CACHE_TTL = SECONDS_PER_HOUR;

// ISO 8601 문자열에서 시(hour) 단위 접두어("YYYY-MM-DDTHH")의 문자 수
export const ISO_DATE_HOUR_PREFIX_LENGTH = 13;

export function buildBriefingCacheKey(dateHour: string): string {
    return `briefing:market:${dateHour}`;
}
