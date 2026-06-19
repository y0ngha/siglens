import { SECONDS_PER_DAY, SECONDS_PER_MINUTE } from '@/shared/config/time';

/** revalidateTag 대상 — 캘린더 ISR 캐시만 무효화한다(스냅샷 캐시와 분리). */
export const ECONOMY_CALENDAR_CACHE_TAG = 'economy:calendar';

/**
 * 캘린더 reader의 `unstable_cache` revalidate — 24h, /economy revalidate(86400)와
 * 단일 TTL 공유. 신선도는 `ensureEconomicCalendarAction`의 revalidateTag가 책임진다.
 */
export const ECONOMY_CALENDAR_REVALIDATE_SECONDS = SECONDS_PER_DAY;

/** ensure가 매 접속마다 ±1개월을 fetch하는 ingestion 윈도(일수). */
export const CALENDAR_INGESTION_WINDOW_DAYS = 30;

/** 'US' — 현재 US 이벤트만 저장/표시. */
export const CALENDAR_COUNTRY = 'US';

const CALENDAR_REFRESH_FLAG_TTL_MINUTES = 60;

/**
 * ensure refresh-flag TTL — 이 윈도 안에 재접속(봇 재크롤 포함)하면 FMP fetch를
 * 건너뛴다. market-news `MARKET_NEWS_REFRESH_FLAG_TTL_SECONDS` 패턴을 미러.
 */
export const CALENDAR_REFRESH_FLAG_TTL_SECONDS =
    CALENDAR_REFRESH_FLAG_TTL_MINUTES * SECONDS_PER_MINUTE;

/** Redis refresh-flag 키 — 단일 글로벌 캘린더(심볼/카테고리 분기 없음). */
export const CALENDAR_REFRESH_FLAG_KEY = 'economy:calendar:refresh';
