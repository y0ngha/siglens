import { SECONDS_PER_DAY, SECONDS_PER_MINUTE } from '@/shared/config/time';

/** revalidateTag 대상 — 캘린더 ISR 캐시만 무효화한다(스냅샷 캐시와 분리). */
export const ECONOMY_CALENDAR_CACHE_TAG = 'economy:calendar';

/**
 * 국가별 캘린더 태그.
 *
 * 전역 태그 하나를 두 국가가 공유하면 한국 인제스션이 미국 `/economy`의 ISR
 * 엔트리까지 날리고 그 반대도 마찬가지라, 두 라우트의 재생성이 각각 두 배가 된다.
 * 시세·신호·브리핑 태그를 scope별로 가른 것과 같은 근거다(blast-radius).
 */
export function economyCalendarCacheTag(country: CalendarCountry): string {
    return `${ECONOMY_CALENDAR_CACHE_TAG}:${country.toLowerCase()}`;
}

/**
 * 캘린더 reader의 `unstable_cache` revalidate — 24h, /economy revalidate(86400)와
 * 단일 TTL 공유. 신선도는 `ensureEconomicCalendarAction`의 revalidateTag가 책임진다.
 */
export const ECONOMY_CALENDAR_REVALIDATE_SECONDS = SECONDS_PER_DAY;

/** ensure가 매 접속마다 fetch하는 미래 방향 ingestion 윈도(일수). */
export const CALENDAR_INGESTION_WINDOW_DAYS = 30;

/**
 * 과거 방향 ingestion 윈도(일수) — 국가별.
 *
 * 미국은 30일이면 충분하다. 지표 시계열을 FMP `/economic-indicators`에서 따로
 * 받아오기 때문에 캘린더는 "다가오는 일정 + 최근 발표"만 있으면 된다.
 *
 * **한국은 다르다.** 지표 카드가 캘린더 발표 이력(`actual`)에서 파생되므로
 * (`getKrIndicatorCards`), 30일만 받으면 월간 지표가 각 1포인트뿐이라
 * `changeFromPrevious`가 영원히 `null`이고 분기 지표(GDP)는 아예 안 뜬다.
 * FMP 플랜 상한(과거 ~180일, 365일은 402)까지 당겨 첫 배포부터 이력이 있게 한다.
 */
export const CALENDAR_PAST_WINDOW_DAYS: Record<CalendarCountry, number> = {
    US: CALENDAR_INGESTION_WINDOW_DAYS,
    KR: 180,
};

/**
 * 캘린더를 수집·표시하는 국가 코드.
 *
 * `/economy`(미국)와 `/economy/kr`(한국)이 같은 `economic_calendar` 테이블을
 * `country` 컬럼으로 나눠 쓴다. FMP는 한 번의 호출로 전 국가를 돌려주고 우리가
 * 국가로 거른다.
 *
 * **왕복은 국가별로 따로 난다.** 조회 창이 다르기 때문이다
 * ({@link CALENDAR_PAST_WINDOW_DAYS} — US 30일 / KR 180일). `from`이 다르면 URL이
 * 달라 Next data cache 엔트리도 갈린다. 창을 통일하면 한 번으로 줄일 수 있지만,
 * 그러려면 미국이 쓰지 않는 180일치를 항상 받아야 해서 지금은 나누는 쪽이 싸다.
 */
export type CalendarCountry = 'US' | 'KR';

/** 'US' — 미국 경제 라우트가 쓰는 국가 코드. */
export const CALENDAR_COUNTRY: CalendarCountry = 'US';

/** 'KR' — 한국 경제 라우트가 쓰는 국가 코드. */
export const CALENDAR_COUNTRY_KR: CalendarCountry = 'KR';

/**
 * 국가 코드 → core `EconomicEventAnalysisInput.region`으로 넘길 표시 이름.
 *
 * core는 이 필드를 **필수**로 요구한다. `'Interest Rate Decision'`·`'CPI YoY'`처럼
 * 이름에 국가가 없는 발표가 많아서, 없으면 모델이 사전 지식으로 되메워 한국은행
 * 결정을 연준 맥락으로 서술한다. 저장이 `analyzed_at IS NULL` 가드로 한 번만
 * 일어나므로 그 서술은 되돌릴 수 없다.
 */
export const CALENDAR_REGION_LABEL: Record<CalendarCountry, string> = {
    US: '미국',
    KR: '한국',
};

/**
 * 화면 문구에 넣을 국가 이름. 캘린더 위젯이 두 라우트에서 공유되므로 빈 상태
 * 문구 같은 것을 하드코딩하면 한국 페이지가 "미국 발표 일정"을 말하게 된다.
 */
export const CALENDAR_COUNTRY_LABEL: Record<CalendarCountry, string> = {
    US: '미국',
    KR: '한국',
};

/**
 * 런타임 값이 우리가 다루는 국가인지. **Server Action 경계에서 쓴다.**
 *
 * Server Action은 공개 호출 가능하고 인자는 직렬화를 건너온다. 좁히지 않으면
 * `country: 'zz'`가 `CALENDAR_PAST_WINDOW_DAYS['zz']`를 `undefined`로 만들어
 * `from`이 `NaN-NaN-NaN`이 되고, 그전에 이미 `economy:calendar:refresh:zz`라는
 * 공격자 지정 Redis 키가 TTL과 함께 써진다(Upstash는 명령당 과금).
 */
export function isCalendarCountry(value: unknown): value is CalendarCountry {
    return value === 'US' || value === 'KR';
}

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

/**
 * Redis refresh-flag 키의 **접두사**. 실제 키는 `calendarRefreshFlag`가 국가를 붙여
 * 만든다(`…:refresh:us` / `…:refresh:kr`) — 하나로 쓰면 `/economy` 한 번 방문이
 * 한국 인제스션 창까지 태워서 KR 행이 영영 안 들어온다.
 */
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

/**
 * Redis 분석 refresh-flag 키의 **접두사**(인제스션 키와 분리). 국가는
 * `calendarAnalysisRefreshFlag`가 붙인다 — 인제스션 키와 같은 이유다.
 */
export const CALENDAR_ANALYSIS_REFRESH_FLAG_KEY =
    'economy:calendar:analysis:refresh';
