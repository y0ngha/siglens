import { SECONDS_PER_DAY, SECONDS_PER_HOUR } from '@/shared/config/time';

/** 티커 검색 결과: 하루 캐시 */
export const TICKER_SEARCH_CACHE_TTL = SECONDS_PER_DAY;

/** 한국어 미보유: 번역 대기 → 12시간 후 재시도 가능하도록 단기 보존 */
export const ASSET_INFO_HOURS_WITHOUT_KOREAN = 12;
/** 한국어 미보유 자산정보 캐시 TTL (초). */
export const ASSET_INFO_CACHE_TTL_WITHOUT_KOREAN =
    ASSET_INFO_HOURS_WITHOUT_KOREAN * SECONDS_PER_HOUR;

/**
 * 한글명 부분 일치 검색용 인스턴스 메모리 스냅샷의 수명. 다른 인스턴스에서 일어난
 * 변경(번역 추가·상폐 표시)은 최대 이만큼 늦게 검색에 반영된다 — 데이터 정본은 DB라
 * 노출 지연일 뿐이다.
 *
 * `MS_PER_MINUTE`로 계산하지 않는 이유: 이 파일은 `@/shared/config/time`을 부분 목으로
 * 바꾼 테스트(`fmpCryptoMembership.test.ts`)도 import하므로, 최상위에서 목에 없는 상수를
 * 읽으면 그 스위트가 로드 시점에 깨진다.
 */
export const KOREAN_SEARCH_SNAPSHOT_TTL_MS = 600_000; // 10분

/**
 * 예전 한글 티커 Redis 캐시 키(`findAll()` 전체를 JSON 배열 하나로, TTL 1년). 지금은
 * 아무도 읽거나 쓰지 않으며 운영 Redis에 남은 사본을 `invalidateKoreanTickerCache`가
 * 지우기 위해서만 참조한다.
 *
 * TODO: 배포 후 KR cron이 한 번 지운 것을 확인하면 이 상수와 DEL 호출을 다음 정리 PR에서 제거한다.
 */
export const LEGACY_KOREAN_TICKERS_REDIS_KEY = 'korean:tickers';

/** FMP cryptocurrency-list membership cache key. */
export const CRYPTO_FMP_LIST_CACHE_KEY = 'crypto:fmp-list';

/**
 * 검색 결과 캐시 키.
 *
 * **결과의 순서나 모양을 바꾸면 `v` 를 올려야 한다.** 이 캐시는 Upstash(외부)라
 * 이미지 롤아웃으로 비워지지 않고 TTL은 24시간이다 — 배포 전 워밍된 질의는 하루
 * 내내 옛 결과를 그대로 돌려주고, 고친 게 배포 안 된 것처럼 보인다.
 * v2: KRX 주 상장을 미국 OTC 중복 앞에 두는 정렬 도입(2026-08).
 * v3: 동점 처리 추가 — 일치한 필드가 짧은 쪽 → 인기 순위 → 입력 순서(2026-10).
 */
export function buildTickerSearchCacheKey(query: string): string {
    return `ticker:search:v3:${query.toLowerCase()}`;
}

/**
 * 자산정보 임시 항목(12시간) 캐시 키.
 *
 * 예전 `asset-info:<SYM>`은 번역 완료분을 1년 TTL로 굳힌 DB 사본이었고 운영 Redis에
 * 32,667개가 남아 있다. 같은 키를 임시 항목에 재사용하면 그 옛 값이 임시 항목으로
 * 읽히므로(DB 미스 뒤에 읽는다 해도 옛 이름이 1년 동안 나간다) 키를 분리했다. 옛 키는
 * 아무도 읽지 않는 고아가 되며, 배포 뒤 일회성 스크립트로 지운다. (32,667은 2026-10
 * 운영 Redis SCAN + PTTL 전수 집계 — PR #915 설명.)
 */
export function buildAssetInfoProvisionalCacheKey(symbol: string): string {
    return `asset-info:provisional:${symbol.toUpperCase()}`;
}
