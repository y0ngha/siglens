export const SECONDS_PER_MINUTE = 60;
export const MINUTES_PER_HOUR = 60;
export const SECONDS_PER_HOUR = SECONDS_PER_MINUTE * 60;
export const SECONDS_PER_DAY = SECONDS_PER_HOUR * 24;
export const SECONDS_PER_YEAR = SECONDS_PER_DAY * 365;
export const MS_PER_SECOND = 1000;
export const MS_PER_MINUTE = SECONDS_PER_MINUTE * MS_PER_SECOND;
export const MS_PER_HOUR = SECONDS_PER_HOUR * MS_PER_SECOND;
export const MS_PER_DAY = SECONDS_PER_DAY * MS_PER_SECOND;
export const KST_OFFSET_HOURS = 9;

/**
 * 재무제표는 분기(~45일) 단위라 길게. fmpGet revalidate + Redis TTL이 이 상수를 공유.
 *
 * Income/balance/cash-flow statements are published on a quarterly cadence
 * (~45 days lag). A 24 h TTL avoids stale data after an earnings release while
 * keeping FMP API call volume manageable.
 */
export const FMP_STATEMENTS_REVALIDATE_SECONDS = SECONDS_PER_DAY; // 24h
