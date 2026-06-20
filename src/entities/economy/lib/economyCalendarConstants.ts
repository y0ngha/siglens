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

/**
 * 분석 ensure가 동시에 호출하는 core submitEconomicEventAnalysis 최대 병렬 수.
 * market-news LLM_PARALLEL_LIMIT 패턴 — worker 큐 stampede 방지. 발표 Medium+ 미분석분이
 * 매 접속 소수라 작게 잡는다.
 */
export const CALENDAR_ANALYSIS_PARALLEL_LIMIT = 4;

/** core가 표준 Record 키로 받는 Medium+ 임팩트 집합 — 분석 대상 필터. */
export const CALENDAR_ANALYZED_IMPACTS = ['High', 'Medium'] as const;

const CALENDAR_ANALYSIS_REFRESH_FLAG_TTL_MINUTES = 30;

/**
 * 분석 pass refresh-flag TTL — 이 윈도 안 재접속(봇 재크롤 포함)이면 분석 스캔을 건너뛴다.
 * SP-A 인제스션 플래그와 별도 키라 두 pass가 독립적으로 쓰로틀된다.
 */
export const CALENDAR_ANALYSIS_REFRESH_FLAG_TTL_SECONDS =
    CALENDAR_ANALYSIS_REFRESH_FLAG_TTL_MINUTES * SECONDS_PER_MINUTE;

/** Redis 분석 refresh-flag 키 — 단일 글로벌 캘린더(SP-A 인제스션 키와 분리). */
export const CALENDAR_ANALYSIS_REFRESH_FLAG_KEY =
    'economy:calendar:analysis:refresh';

/**
 * core submit→poll 주기 (ms). flash-lite 평균 <10s,
 * `CALENDAR_ANALYSIS_POLL_MAX_ATTEMPTS`회 × 2s 상한이라 serverless waitUntil 예산 내 충분하다.
 * market-news POLL_INTERVAL_MS 패턴 미러.
 */
export const CALENDAR_ANALYSIS_POLL_INTERVAL_MS = 2_000;

/**
 * poll 최대 시도 횟수. `CALENDAR_ANALYSIS_POLL_MAX_ATTEMPTS`회 × 2s 상한(market-news POLL_MAX_ATTEMPTS 미러).
 * 초과 시 해당 이벤트는 건너뛰고 다음 접속/플래그 만료 시 재시도된다.
 */
export const CALENDAR_ANALYSIS_POLL_MAX_ATTEMPTS = 30;
