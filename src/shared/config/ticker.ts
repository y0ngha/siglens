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

/**
 * 점(.) 뒤에 올 수 있는 접미사 화이트리스트 — 미국 주식의 **클래스 구분자**만 허용한다.
 *
 * `SYMBOL_EDGE_RE`가 점을 허용하는 유일한 이유는 `BRK.B` 같은 dual-class 주식이다
 * (TICKER_RE JSDoc 참조). 그런데 이 규칙은 형상만 보므로 `HVO.L`(런던), `SHOP.TO`(토론토),
 * `XYZ.V`(TSXV) 같은 **해외 거래소 접미사 심볼도 똑같이 통과**시킨다. 이 서비스는 미국
 * 주식·암호화폐만 다루고 FMP 플랜에도 해외 거래소가 포함돼 있지 않아, 이런 심볼은
 * 100% FMP 402(Payment Required)로 끝난다.
 *
 * 실측(2026-07-25, 야간 pre-warm 창 전후): 402가 발생한 61개 고유 심볼이 **전부** 해외
 * 접미사(`.L` 44 / `.V` 9 / `.CN` 7 / `.TO` 1)였고 미국 심볼은 0건이었다. 하루 약 7,400회의
 * FMP 호출이 이 경로로 낭비됐다.
 *
 * **blocklist가 아니라 allowlist인 이유**: 거래소 코드는 60개가 넘고 계속 늘어난다.
 * 반대로 우리가 점을 허용해야 하는 케이스는 미국 클래스 구분자 한 종류뿐이라, 허용
 * 집합이 압도적으로 작고 안정적이다. 새 거래소가 생겨도 자동으로 막힌다.
 *
 * 포함 근거:
 *  - `A`/`B`/`C` — dual/multi-class 보통주 (`BRK.B`, `BF.A`, `HEI.A`, `LGF.B`)
 *  - `U`/`W`/`WS` — SPAC 유닛·워런트 (`XXXX.U`, `XXXX.WS`). 거래소 코드와 충돌하지 않는다
 *    (바르샤바는 `.WA`, TSXV는 `.V` — 워런트 접미사와 겹치는 거래소 코드는 없다).
 *
 * ⚠️ 알려진 잔여 구멍: 캐나다 USD 결제분 표기(`XYZ.U`)는 `U` 접미사라 통과한다. FMP 플랜
 * 대상이 아니므로 조회 1회를 낭비하고 빈 결과로 끝난다. 형상만으로는 미국 SPAC 유닛과
 * 구분할 수 없어 의도적으로 남겨둔 트레이드오프다(주 목적인 `.L`/`.TO`/`.V`/`.CN`은 전부 차단).
 *
 * 이 집합은 {@link toFmpSearchSymbol}과 짝을 이룬다 — 여기서 **허용한** 접미사는 FMP 조회
 * 시 하이픈 표기로 정규화돼 실제로 해결된다. 한쪽만 바꾸면 "통과했는데 영영 못 찾는"
 * 하드 404가 생기므로, 접미사를 추가/제거할 땐 반드시 양쪽을 같이 본다.
 *
 * ⚠️ 또 하나의 잔여 구멍: 검사는 **마지막 점** 기준이라 다중 점 표기가 전부 막히지는
 * 않는다. `BAC.PR.K`는 차단되지만 `BAC.PR.A`처럼 A/B/C로 끝나면 통과한 뒤 `BAC.PR-A`로
 * 정규화돼 FMP 호출 1회를 낭비하고 결국 404가 된다. 미국 우선주 표기를 형상만으로
 * dual-class와 구분할 수 없어 남겨둔 트레이드오프다.
 */
export const SUPPORTED_DOT_SUFFIXES: ReadonlySet<string> = new Set([
    'A',
    'B',
    'C',
    'U',
    'W',
    'WS',
]);

/** {@link splitDotSuffix}의 반환 타입 — 점 앞뒤로 쪼갠 base/suffix 쌍. */
export interface SymbolDotSuffixParts {
    base: string;
    suffix: string;
}

/**
 * 대문자 심볼을 `{ base, suffix }`로 쪼갠다 — 점이 없거나 맨 앞에 있으면 `null`.
 *
 * `isAdmissibleSymbolShape`(허용 판정)과 `toFmpSearchSymbol`(하이픈 정규화)이 **같은**
 * 규칙으로 접미사를 떼어내야 하므로 여기 한 곳에만 둔다. 각자 `lastIndexOf('.')`를
 * 구현하면 "통과했는데 정규화는 안 되는" 하드 404가 조용히 생긴다.
 */
export function splitDotSuffix(upper: string): SymbolDotSuffixParts | null {
    const lastDot = upper.lastIndexOf('.');
    if (lastDot <= 0) return null;
    return { base: upper.slice(0, lastDot), suffix: upper.slice(lastDot + 1) };
}

/** 점이 없으면 통과, 있으면 접미사가 {@link SUPPORTED_DOT_SUFFIXES}에 속할 때만 통과. */
function hasSupportedDotSuffix(upper: string): boolean {
    if (!upper.includes('.')) return true;
    const parts = splitDotSuffix(upper);
    return parts !== null && SUPPORTED_DOT_SUFFIXES.has(parts.suffix);
}

/**
 * Edge-safe format pre-check; uppercases then tests against SYMBOL_EDGE_RE.
 * Normalizes case internally, so callers need not pre-uppercase; passing an
 * already-uppercased value (as `getAssetInfo` does) is harmless/defensive.
 *
 * 형상 통과 후 해외 거래소 접미사를 추가로 걸러낸다 — FMP 호출 **이전** 단계라
 * 402가 원천적으로 발생하지 않는다.
 */
export function isAdmissibleSymbolShape(symbol: string): boolean {
    const upper = symbol.toUpperCase();
    return SYMBOL_EDGE_RE.test(upper) && hasSupportedDotSuffix(upper);
}
