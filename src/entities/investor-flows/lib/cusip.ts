import { normalizeCusip } from './sec13fPositions';

const CUSIP_CHAR_VALUE = (char: string): number => {
    if (char >= '0' && char <= '9') return Number(char);
    if (char >= 'A' && char <= 'Z') return char.charCodeAt(0) - 55;
    if (char === '*') return 36;
    if (char === '@') return 37;
    return 38; // '#'
};

/** CUSIP 9번째 자리(검증 숫자) 계산 — 표준 mod-10 double-add-double 알고리즘. */
function cusipCheckDigit(base8: string): number {
    let sum = 0;
    for (let i = 0; i < 8; i++) {
        let value = CUSIP_CHAR_VALUE(base8[i] as string);
        if (i % 2 === 1) value *= 2;
        sum += Math.floor(value / 10) + (value % 10);
    }
    return (10 - (sum % 10)) % 10;
}

/** 9자리 CUSIP의 검증 숫자가 맞는지. */
export function isValidCusipChecksum(cusip: string): boolean {
    return (
        cusip.length === 9 &&
        cusipCheckDigit(cusip.slice(0, 8)) === Number(cusip[8])
    );
}

/**
 * FMP profile `cusip`을 받아들인다. 형식(9자리 영숫자)만 보고 검증 숫자는 보지 않는다 —
 * FMP가 준 값을 신뢰하되 쓰레기만 거른다.
 */
export function parseProfileCusip(raw: unknown): string | null {
    return typeof raw === 'string' ? normalizeCusip(raw) : null;
}

/**
 * 미국·캐나다 ISIN(`US` + 9자리 CUSIP + 검증 숫자)에서 CUSIP을 꺼낸다. CUSIP 검증 숫자가 맞지
 * 않으면 null — 형식만 맞는 쓰레기를 후보로 올리지 않는다.
 */
export function cusipFromIsin(raw: unknown): string | null {
    if (typeof raw !== 'string') return null;
    const isin = raw.trim().toUpperCase();
    if (!/^(US|CA)[0-9A-Z]{9}[0-9]$/.test(isin)) return null;
    const cusip = isin.slice(2, 11);
    return isValidCusipChecksum(cusip) ? cusip : null;
}

/** 티커 비교용 정규화 — 대문자 + 클래스 구분자(`.`·`-`·`/`·공백) 제거. */
export function normalizeTickerForMatch(ticker: string): string {
    return ticker.toUpperCase().replace(/[.\-/\s]/g, '');
}

/** OpenFIGI가 돌려준 티커 중 우리 심볼과 같은 것이 있는지. */
export function figiTickersMatchSymbol(
    figiTickers: readonly string[],
    symbol: string
): boolean {
    const wanted = normalizeTickerForMatch(symbol);
    return figiTickers.some(
        ticker => normalizeTickerForMatch(ticker) === wanted
    );
}
