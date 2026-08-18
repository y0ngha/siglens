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

/**
 * 캘린더를 수집·표시하는 국가 코드.
 *
 * `/economy`(미국)와 `/economy/kr`(한국)이 같은 `economic_calendar` 테이블을
 * `country` 컬럼으로 나눠 쓴다. FMP는 한 번의 호출로 전 국가를 돌려주므로
 * 인제스션은 국가별로 필터만 다르고 왕복 수는 같다(같은 URL이라 Next data cache 공유).
 */
export type CalendarCountry = 'US' | 'KR';

/** 'US' — 미국 경제 라우트가 쓰는 국가 코드. */
export const CALENDAR_COUNTRY: CalendarCountry = 'US';

/** 'KR' — 한국 경제 라우트가 쓰는 국가 코드. */
export const CALENDAR_COUNTRY_KR: CalendarCountry = 'KR';

/**
 * 한국 지표 카드가 되짚는 발표 이력의 길이(일).
 *
 * FMP 플랜의 캘린더 조회 상한이 과거 ~180일이다(365일은 402 Premium). 월간 지표
 * 기준 5~6포인트라 얇지만, DB에 누적되면서 자연히 길어진다 — 이 값은 **DB 읽기
 * 창**이므로 상한이 풀리면 그대로 늘어난다.
 */
export const KR_INDICATOR_HISTORY_DAYS = 400;

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
 * 분석 ensure가 동시에 호출하는 core runEconomicEventAnalysis 최대 병렬 수.
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
