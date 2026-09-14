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

/** 12h — 뉴스/옵션/종합 페이지 캐시 TTL(페이지 revalidate와 맞춰 s-maxage clamp 방지). */
export const SECONDS_PER_HALF_DAY = SECONDS_PER_HOUR * 12;
/** 6h — 종목 차트(bars/analysis peek) 캐시 TTL = 공유 layout이 만드는 symbol 라우트 floor. */
export const SECONDS_PER_QUARTER_DAY = SECONDS_PER_HOUR * 6;

/**
 * 재무제표는 분기(~45일) 단위라 길게. fmpGet revalidate + Redis TTL이 이 상수를 공유.
 *
 * Income/balance/cash-flow statements are published on a quarterly cadence
 * (~45 days lag). A 24 h TTL avoids stale data after an earnings release while
 * keeping FMP API call volume manageable.
 */
export const FMP_STATEMENTS_REVALIDATE_SECONDS = SECONDS_PER_DAY; // 24h
export const CONGRESS_REVALIDATE_SECONDS = SECONDS_PER_DAY; // 24h — 의회 거래 공시지연 ~45일

/**
 * `'YYYY-MM-DDTHH'` (length 13) → `new Date().toISOString().slice(0, 13)` gives
 * the current UTC hour string (e.g. `'2026-06-17T14'`), used as an
 * `unstable_cache`/cache-key hour bucket by multiple callers. Mirrors
 * `ISO_DATE_HOUR_PREFIX_LENGTH` in `@y0ngha/siglens-core` (internal, not
 * exported — e.g. `peekMacroBriefingCache`'s own hour bucket) — must stay in
 * sync with that value.
 */
export const ISO_DATE_HOUR_SLICE_END = 13;

/**
 * `'YYYY-MM-DD'`(length 10) — `date.toISOString().slice(0, ISO_DATE_LENGTH)`로
 * ISO 인스턴트에서 날짜만 잘라낼 때 쓰는 상수. `etTimeUtils`, `FmpEconomyProvider`,
 * `YahooMarketProvider`, `fetchKrDailyCloses`가 각자 동일한 리터럴 10을 들고
 * 있었다 — 한 곳으로 모아 드리프트를 막는다.
 */
export const ISO_DATE_LENGTH = 10;
