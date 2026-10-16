/** SEC CIK → 우리 심볼 한 쌍(`sec_cik_symbol_map` 한 행). */
export interface CikSymbolPair {
    cik: number;
    symbol: string;
}

interface CompanyTickerEntry {
    cik_str: number;
    ticker: string;
}

/** `company_tickers.json`의 한 행 — CIK는 양의 정수, 티커는 문자열. 형식이 다른 행은 버린다. */
function isCompanyTickerEntry(entry: unknown): entry is CompanyTickerEntry {
    return (
        typeof entry === 'object' &&
        entry !== null &&
        'cik_str' in entry &&
        'ticker' in entry &&
        typeof entry.cik_str === 'number' &&
        Number.isInteger(entry.cik_str) &&
        entry.cik_str > 0 &&
        typeof entry.ticker === 'string'
    );
}

/** 클래스 구분자 `.`와 `-`를 같은 것으로 본다(SEC는 `BRK-B`, 유니버스 일부는 `BF.B`). 다른 별칭은 쓰지 않는다. */
const classKey = (symbol: string): string =>
    symbol.trim().toUpperCase().replaceAll('.', '-');

/**
 * `www.sec.gov/files/company_tickers.json`(`{"0": {cik_str, ticker, title}, …}`, 2026-10-16 실측 10,444행) → 유니버스에 있는
 * (CIK, 우리 심볼) 쌍. 한 CIK에 유니버스 티커가 여럿이면(`GOOG`·`GOOGL`, `BRK-A`·`BRK-B`) 전부 남긴다.
 *
 * 매칭은 정확 일치에 `.`↔`-`만 허용한다 — FINRA용 별칭(구분자 제거 `BFB` 등)을 쓰면 다른 회사의 티커가 우리 클래스 주식에
 * 붙을 수 있다. 형식이 다른 행(숫자가 아닌 CIK, 빈 티커)은 버린다. 같은 쌍은 한 번만.
 */
export function parseCompanyTickers(
    json: unknown,
    universeSymbols: Iterable<string>
): CikSymbolPair[] {
    if (typeof json !== 'object' || json === null) return [];
    const universe = new Map(
        [...universeSymbols].map(symbol => [classKey(symbol), symbol])
    );
    const seen = new Set<string>();
    const entries: unknown[] = Object.values(json);
    return entries.filter(isCompanyTickerEntry).flatMap(entry => {
        const symbol = universe.get(classKey(entry.ticker));
        if (symbol === undefined) return [];
        const key = `${entry.cik_str}|${symbol}`;
        if (seen.has(key)) return [];
        seen.add(key);
        return [{ cik: entry.cik_str, symbol }];
    });
}
