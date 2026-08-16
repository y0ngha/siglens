/** 거래소 코드/표시명 쌍. `TickerSearchResult`·`KoreanTickerEntry`가 요구하는 두 필드. */
export interface KrExchange {
    code: string;
    fullName: string;
}

/**
 * `.KS` → KOSPI, `.KQ` → KOSDAQ.
 *
 * yahoo가 응답에 담아 주는 exchange 코드(`KSC`/`KOE`)를 쓰지 않고 심볼 접미사에서
 * 유도한다 — quote와 search가 서로 다른 표기를 쓰는 데다(크립토에서 FMP가 `CCC`/`CRYPTO`로
 * 갈렸던 것과 같은 문제), 접미사는 canonical 심볼의 일부라 소스와 무관하게 항상 존재한다.
 */
export function krExchangeOf(symbol: string): KrExchange {
    return symbol.toUpperCase().endsWith('.KQ')
        ? { code: 'KOSDAQ', fullName: 'KOSDAQ' }
        : { code: 'KOSPI', fullName: 'Korea Exchange (KOSPI)' };
}
