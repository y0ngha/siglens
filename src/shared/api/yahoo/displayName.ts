/**
 * yahoo 표시명 정리 — 순수 함수만 둔다.
 *
 * `yahoo-finance2`를 import하지 않고 `server-only`도 선언하지 않는다. 이 규칙 덕분에
 * 클라이언트 번들에 닿는 모듈(`entities/ticker`의 검색 경로)과 서버 전용 어댑터가
 * **같은 판정 로직을 공유**할 수 있다. yahoo SDK를 import하는 순간 Node 전용
 * (`child_process`/`dns`) 의존이 따라붙어 이 공유가 깨진다.
 */

/**
 * yahoo가 회사명을 못 붙인 종목에 심볼·내부 코드를 콤마로 이어붙인 문자열을 내려보낸다.
 *
 * 실측(2026-08-16): `900140.KQ` → `longName = "900140.KQ,0P0000RVWF,493004"`.
 * `quoteType`도 `MUTUALFUND`로 오분류된다. 걸러내지 않으면 검색 결과·종목 페이지 제목·
 * SEO 메타데이터에 코드 나열이 그대로 박힌다.
 *
 * "콤마 포함"으로는 판정할 수 없다 — 정상 사명에도 콤마가 흔하다
 * (`Samsung Electronics Co., Ltd.`, `Kia Corporation`).
 *
 * "심볼로 시작"만으로도 부족하다 — `HPSP Co., Ltd.`처럼 사명이 곧 티커인 종목이
 * 오탐된다. 판별 근거는 **심볼 바로 뒤에 콤마가 붙는다**는 점이다. 정상 사명은
 * 티커로 시작하더라도 그 뒤에 공백이나 다른 글자가 온다.
 */
export function isGarbledYahooName(name: string, symbol: string): boolean {
    return name.startsWith(`${symbol},`);
}

/**
 * 표시명 후보 중 첫 번째 쓸 만한 값을 고른다. 전부 못 쓰면 심볼로 폴백한다.
 *
 * 폴백이 심볼인 이유: 빈 문자열을 돌려주면 상위에서 제목이 통째로 비고, 코드 나열을
 * 그대로 쓰면 사용자에게 의미 없는 문자열이 노출된다. 심볼은 최소한 정확하다.
 */
export function pickYahooDisplayName(
    symbol: string,
    ...candidates: (string | undefined | null)[]
): string {
    for (const candidate of candidates) {
        const trimmed = candidate?.trim();
        if (trimmed && !isGarbledYahooName(trimmed, symbol)) return trimmed;
    }
    return symbol;
}
