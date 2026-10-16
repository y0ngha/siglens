/**
 * SigLens public API (`/api/v1/*`) 상수의 단일 출처.
 *
 * 한도 숫자는 출발값이다(설계 §4·§10) — 운영 지표를 본 뒤 여기 한 곳만 고친다.
 * SKILL.md 생성기와 `/api/v1/me`, 테스트가 모두 이 값을 읽으므로 문구에 숫자를
 * 따로 적지 않는다.
 */

/** 경로 접두. 라우트 폴더(`src/app/api/v1`)와 SKILL.md의 curl 예시가 같은 값을 쓴다. */
export const PUBLIC_API_BASE_PATH = '/api/v1';

/**
 * 인증 없이 받는 문서 경로(`PUBLIC_API_BASE_PATH` 아래). 라우트 폴더, OpenAPI 문서의 `paths`,
 * `/developers`의 내려받기 링크가 같은 값을 쓴다.
 */
export const PUBLIC_API_DOC_PATHS = {
    skill: '/skill',
    openapiJson: '/openapi.json',
    openapiYaml: '/openapi.yaml',
} as const;

/** 키를 담는 환경 변수 이름. SKILL.md·계정 화면 시작 가이드·`/developers`·curl 예시가 같은 이름을 쓴다. */
export const API_KEY_ENV_NAME = 'SIGLENS_API_KEY';

/**
 * 문서에 적는 로케일 헤더 이름(SKILL.md와 같은 표기). 라우트가 읽는 값(`ANALYSIS_LOCALE_HEADER`)은 소문자
 * 정규형이라 HTTP 헤더 이름의 대소문자 무시로만 같다 — 테스트가 둘이 같은 헤더를 가리킴을 고정한다.
 */
export const LOCALE_HEADER_DOC_NAME = 'X-Siglens-Locale';

/** 개발자 포털(`/developers`)의 로케일 접두사 없는 경로. */
export const DEVELOPERS_PATH = '/developers';

/**
 * `/developers` 본문 마지막 갱신일 — 본문(`messages/*.json`의 `views.developers`)이나 문서 구성을 고치면
 * 함께 올린다. 화면 하단 "마지막 업데이트", JSON-LD `dateModified`, 정적 sitemap `lastmod`가 이 값 하나를 읽는다
 * (배포 시각을 쓰면 본문을 안 고친 배포까지 "갱신됨"으로 나간다). 도구 목록은 코어에서 와서 따로 올릴 필요가 없다.
 */
export const DEVELOPERS_UPDATED_AT = new Date('2026-10-16T00:00:00+09:00');

/** 키 원문 접두. 이 접두로 시작하지 않는 Bearer 값은 DB를 보기 전에 거절한다. */
export const API_KEY_PREFIX = 'slk_';

/** 접두 뒤 base62 무작위 문자 수 (≈238 bit). */
export const API_KEY_RANDOM_LENGTH = 40;

/** 목록에 보여 줄 접두 길이: `slk_` + 무작위 6자. */
export const API_KEY_DISPLAY_PREFIX_LENGTH = API_KEY_PREFIX.length + 6;

/** 회원당 활성(폐기되지 않은) 키 상한. */
export const API_KEY_MAX_ACTIVE_PER_USER = 5;

export const API_KEY_NAME_MAX_LENGTH = 64;

/**
 * 인증 조회 결과(키 해시 → 주체)의 Redis 캐시 TTL.
 * 폐기와 탈퇴는 묘비 키(`siglens-api:revoked:{hash}`)로 즉시 반영된다 — 캐시 적중에서도
 * 묘비를 함께 읽는다. 이 TTL은 등급·이메일 인증 상태 변화가 반영되는 최대 지연이다.
 */
export const API_KEY_AUTH_CACHE_TTL_SECONDS = 60;

/** `last_used_at`을 갱신하는 최소 간격(쓰기 폭주 방지). */
export const API_KEY_LAST_USED_THROTTLE_SECONDS = 60;

/** 요청 본문 상한(바이트 근사: 문자 수). 도구 인자는 심볼 몇 개 수준이라 넉넉하다. */
export const PUBLIC_API_MAX_BODY_CHARS = 8_192;

export const PUBLIC_API_RATE_BUCKETS = ['data', 'ai'] as const;
export type PublicApiRateBucket = (typeof PUBLIC_API_RATE_BUCKETS)[number];

export interface PublicApiRateLimit {
    readonly perMinute: number;
    readonly perDay: number;
}

/**
 * 회원(userId) 단위 고정 창 한도 — 키를 폐기·재발급해도 카운터가 이어진다. `data`는 데이터 도구 전부, `ai`는 캐시 미스로 LLM을 부르는
 * 분석 생성 시도(`run_fresh_analysis`가 캐시 미스로 사용자 키 LLM을 부를 때만 소비; 캐시 적중은 `data`만 쓴다). 회원 tier와 무관하게 같다(1차).
 */
export const PUBLIC_API_RATE_LIMITS: Readonly<
    Record<PublicApiRateBucket, PublicApiRateLimit>
> = {
    data: { perMinute: 60, perDay: 3_000 },
    ai: { perMinute: 10, perDay: 200 },
};

/**
 * 폐기한 키 해시의 묘비(tombstone) TTL. 인증 캐시 TTL보다 길어야 한다: 폐기 직전에 DB를
 * 읽은 진행 중 요청이 폐기 뒤에 캐시를 다시 써도(최대 요청 시간 + 캐시 TTL 동안 살아 있다)
 * 그 항목이 만료될 때까지 묘비가 인증을 막는다. 2배 = 캐시 TTL + 요청 시간 여유.
 */
export const API_KEY_REVOKED_TOMBSTONE_TTL_SECONDS =
    API_KEY_AUTH_CACHE_TTL_SECONDS * 2;

/**
 * 공개 API의 도구 결과 크기 상한(문자 수). 에이전트의 상한(4,000 / 6,000 / 16,000)은 여러
 * 단계가 쌓이는 LLM 컨텍스트를 지키려는 값이지만, API는 요청 하나가 도구 하나라 컨텍스트가
 * 자라지 않는다. 그래서 같은 형태의 결과를 덜 자르도록 올린다:
 * - `standard` 16,000: 에이전트 기본값의 4배. 잘리는 일을 드물게 하되 응답이 ~16KB를 넘지 않는다.
 * - `aggregate`/`guide` 24,000: 시장·경제 종합과 가이드 본문은 에이전트에서 6,000으로 접히던 값이다.
 * - `cachedAnalysis` 32,000: 에이전트 상한(16,000)의 2배. 2026-09 실측 가장 큰 기술 분석
 *   (~8,300자)에 쉬운 말 재작성이 붙어도 여유가 있다. 예산도 같은 값(요청당 분석 도구 1회).
 * - `bars` 6,000: `get_bars_indicators`가 스스로 이 값에 맞춰 봉 수를 줄이므로 실행기 상한을
 *   올려도 효과가 없다 — 요청의 `bars` 인자를 줄이는 것이 방법이다.
 * `get_news`도 자체 예산(4,000)으로 항목을 줄이며 실행기 상한과 무관하다.
 */
export const PUBLIC_API_RESULT_CAPS = {
    standard: 16_000,
    bars: 6_000,
    aggregate: 24_000,
    guide: 24_000,
    cachedAnalysis: 32_000,
    cachedAnalysisBudget: 32_000,
} as const;
