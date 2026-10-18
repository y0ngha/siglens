import {
    MS_PER_MINUTE,
    SECONDS_PER_DAY,
    SECONDS_PER_HOUR,
} from '@/shared/config/time';

/**
 * 종목의 KRX 호가표(주식/ETF) 캐시 수명. 종목 유형은 상장 기간 내내 바뀌지 않아 길게 잡아도
 * 오답이 되지 않는다 — 판정 규칙이 바뀔 때만 키 버전으로 무효화한다(`buildKrxTickTableCacheKey`).
 */
export const KRX_TICK_TABLE_CACHE_DAYS = 30;
/** {@link KRX_TICK_TABLE_CACHE_DAYS}를 초로. */
export const KRX_TICK_TABLE_CACHE_TTL =
    KRX_TICK_TABLE_CACHE_DAYS * SECONDS_PER_DAY;

/** 종목의 KRX 호가표 캐시 키(`resolveKrxTickTable`). */
export function buildKrxTickTableCacheKey(symbol: string): string {
    return `krx-tick-table:v1:${symbol.toUpperCase()}`;
}

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
 */
export const KOREAN_SEARCH_SNAPSHOT_TTL_MS = 10 * MS_PER_MINUTE;

/**
 * 공개 API(서버 키 LLM을 못 쓰는 흐름) 전용 캐시 수명: 번역 없는 결과를 반복 호출마다 FMP/Yahoo로 다시 받지
 * 않게 하는 용도다. 웹 항목(24시간·12시간)을 가리지 않도록 **키도 분리**하고 수명도 짧게(1시간) 둔다.
 */
export const API_UNTRANSLATED_CACHE_TTL = SECONDS_PER_HOUR;

/**
 * API 전용 번역 없는 검색 결과 캐시 키. 네임스페이스를 사용자 입력 **앞**의 고정 접두에 둔다 — 뒤에 접미로
 * 붙이면 웹 질의 `x:api-untranslated`가 `x`의 API 키와 같은 문자열이 된다. 버전은 웹 키와 함께 오른다.
 */
export function buildApiTickerSearchCacheKey(query: string): string {
    return `ticker:search:api-untranslated:${TICKER_SEARCH_CACHE_VERSION}:${query.toLowerCase()}`;
}

/** API 전용 번역 없는 자산정보 캐시 키. 웹이 읽는 임시 항목 키(`asset-info:provisional:`)와 접두가 다르다. */
export function buildApiAssetInfoCacheKey(symbol: string): string {
    return `asset-info:api-untranslated:${symbol.toUpperCase()}`;
}

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
const TICKER_SEARCH_CACHE_VERSION = 'v3';

export function buildTickerSearchCacheKey(query: string): string {
    return `ticker:search:${TICKER_SEARCH_CACHE_VERSION}:${query.toLowerCase()}`;
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
