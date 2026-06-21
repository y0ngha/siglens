/**
 * US ticker shape — Single source of truth.
 *
 * `src/proxy.ts`(edge runtime)와 `src/domain/constants/market.ts`(앱 본체) 양쪽에서
 * 모두 사용하는 정규식이다. 이 파일은 외부 의존이 0이고 type-only import도 없어
 * Turbopack edge runtime에서 안전하게 import 가능하다 — 과거 `market.ts`에서 직접
 * import할 때 cross-module type 의존성 때문에 dev 환경 [symbol] 라우트의 데이터 fetch가
 * 간헐적으로 차단되는 회귀가 관찰됐었다.
 *
 * 형상: 1~8글자 영문 대문자, 첫 글자는 대문자로 고정 (빈 입력/기호 시작 차단).
 *  - 점(.): `BRK.B` 같은 클래스 구분
 *  - 하이픈(-): `PBR-A` 같은 ADR 우선주
 */
export const TICKER_RE = /^[A-Z][A-Z.-]{0,7}$/;

/**
 * Edge-safe admissible-symbol superset — admits BOTH US equity shapes and
 * FMP crypto shapes (digit-first like `1000SATSUSD`, hyphenated like
 * `1-UPUSD`, up to 16 chars). This only ADMITS a candidate at the edge
 * (proxy.ts) and as a page-level format pre-check; the AUTHORITATIVE
 * decision of "is this a real, classified asset" happens server-side in
 * getAssetInfo (crypto_assets DB membership). Dependency-free for edge runtime.
 */
export const SYMBOL_EDGE_RE = /^[A-Z0-9][A-Z0-9.-]{0,15}$/;

/** Edge-safe format pre-check; uppercases then tests against SYMBOL_EDGE_RE. */
export function isAdmissibleSymbolShape(symbol: string): boolean {
    return SYMBOL_EDGE_RE.test(symbol.toUpperCase());
}
