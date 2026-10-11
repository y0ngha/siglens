/**
 * 매핑 하나를 실행하고, 던지면 경고만 남기고 `null`을 돌려준다.
 *
 * quote 스냅샷(`getQuoteSnapshot`)은 업스트림 행 하나로 시세와 오늘 봉을 함께 만든다. 한쪽
 * 매핑이 깨진 행(예: timestamp가 숫자가 아님)에 던져도 다른 쪽은 살려야 하므로 매핑마다 따로
 * 감싼다. FMP·yahoo 어댑터가 같은 규칙을 쓰도록 여기 한 곳에 둔다.
 *
 * @param source 로그 접두사로 쓸 어댑터 이름(예: `FmpMarketProvider`).
 * @param label 어떤 매핑인지(예: `getQuote`, `today-quote`).
 */
export function mapOrNull<T>(
    source: string,
    label: string,
    symbol: string,
    map: () => T
): T | null {
    try {
        return map();
    } catch (error) {
        console.warn(`[${source}] ${label} mapping failed:`, symbol, error);
        return null;
    }
}
