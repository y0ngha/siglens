export const SECONDS_PER_MINUTE = 60;
export const MINUTES_PER_HOUR = 60;
export const SECONDS_PER_HOUR = SECONDS_PER_MINUTE * 60;
export const HOURS_PER_DAY = 24;
export const SECONDS_PER_DAY = SECONDS_PER_HOUR * HOURS_PER_DAY;
export const SECONDS_PER_YEAR = SECONDS_PER_DAY * 365;
export const MS_PER_SECOND = 1000;
export const MS_PER_MINUTE = SECONDS_PER_MINUTE * MS_PER_SECOND;
export const MS_PER_HOUR = SECONDS_PER_HOUR * MS_PER_SECOND;
export const MS_PER_DAY = SECONDS_PER_DAY * MS_PER_SECOND;
export const KST_OFFSET_HOURS = 9;

/**
 * 30min — 장 마감 뒤 EOD 데이터 정착 대기(spec §6). 스냅샷 신선도 경계
 * (`seo-snapshot/lib/freshness`)와 캡션의 "직전 완료 세션" 판정(`formatSnapshotAsOf`)이
 * **같은 값**을 써야 한다 — 따로 두면 캡션이 말하는 세션과 신선도가 보는 세션이 갈린다.
 */
export const SETTLE_BUFFER_MINUTES = 30;

/** 12h — 뉴스/옵션/종합 페이지 캐시 TTL(페이지 revalidate와 맞춰 s-maxage clamp 방지). */
export const SECONDS_PER_HALF_DAY = SECONDS_PER_HOUR * 12;
/** 6h — 종목 차트 탭(bars/analysis peek) 캐시 TTL. 이 값을 읽는 라우트는 6h 이하로 clamp된다. */
export const SECONDS_PER_QUARTER_DAY = SECONDS_PER_HOUR * 6;

/**
 * 24h — **세션 날짜를 키에 넣은** 정적 캐시(`sessionBarsStaticCache`, 종목 탭의 시장 공포·탐욕
 * 판독)의 revalidate.
 *
 * 신선도는 이 값이 아니라 키가 책임진다 — 키의 세션 날짜(`lastClosedSessionDate`)가 넘어가면
 * 다음 렌더는 새 키를 읽는다. 그래서 revalidate를 `[symbol]` 탭 중 가장 긴 선언값(24h) 이상으로
 * 둘 수 있고, Next 16의 "렌더 중 읽힌 `unstable_cache` revalidate 최솟값으로 라우트를 clamp"
 * 규칙에 걸리지 않는다. 탭 선언값과의 관계는 `src/__tests__/guards/symbolTabRevalidateClamp.test.ts`가
 * 고정한다 — 탭 revalidate를 24h보다 길게 올리면 이 값도 함께 올려야 한다.
 */
export const SESSION_KEYED_CACHE_REVALIDATE_SECONDS = SECONDS_PER_DAY;

/*
 * FMP 펀더멘털·재무제표·의회 거래의 Redis(`getOrSetCache`) TTL. 이 데이터의 유일한 서버
 * 캐시 계층이다 — 안쪽 `fmpGet`은 Next 데이터 캐시를 쓰지 않는다(`httpClient.ts`의
 * `fmpGet` JSDoc 참고). 화면은 이 위에 `staticSymbolCache`(`unstable_cache`)를 한 겹 더
 * 두지만 그건 렌더 결과 캐시이고, FMP 응답 자체는 여기서만 묵는다.
 */

/** 24h — 프로필·밸류에이션·성장·애널리스트 등. 분기 단위 재무와 정합. */
export const FMP_FUNDAMENTAL_CACHE_TTL_SECONDS = SECONDS_PER_DAY;
/**
 * 24h — 재무제표는 분기(~45일) 단위로 나오지만, 실적 발표 직후 하루 넘게 옛 값을
 * 보이지 않도록 하루로 둔다.
 */
export const FMP_STATEMENTS_CACHE_TTL_SECONDS = SECONDS_PER_DAY;
export const CONGRESS_CACHE_TTL_SECONDS = SECONDS_PER_DAY; // 24h — 의회 거래 공시지연 ~45일

/**
 * `'YYYY-MM-DDTHH'` (length 13) → `new Date().toISOString().slice(0, 13)` gives
 * the current UTC hour string (e.g. `'2026-06-17T14'`), used as an
 * `unstable_cache`/cache-key hour bucket by multiple callers. Mirrors
 * `ISO_DATE_HOUR_PREFIX_LENGTH` in `@y0ngha/siglens-core` (internal, not
 * exported — e.g. `peekBriefingCache`'s own hour bucket; the macro briefing
 * moved to a UTC-date bucket, see `macroBriefingDayKey`) — must stay in sync
 * with that value.
 */
export const ISO_DATE_HOUR_SLICE_END = 13;

/**
 * `'YYYY-MM-DD'`(length 10) — ISO 인스턴트에서 날짜만 잘라낼 때 쓰는 상수.
 * `Date` → UTC 날짜 문자열은 이 상수를 쓰는 `toUtcIsoDate`(`shared/lib/isoDate`)를
 * 호출한다. 여러 모듈이 각자 리터럴 10을 들고 있었다 — 한 곳으로 모아 드리프트를 막는다.
 */
export const ISO_DATE_LENGTH = 10;
