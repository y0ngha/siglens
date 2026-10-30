/** 심볼만 있으면 되는 보유·관심종목 항목. 심볼 대소문자는 출처마다 다를 수 있다. */
interface SymbolEntry {
    symbol: string;
}

/**
 * 메일 리포트 대상(보유∪관심)의 종목 수. 두 목록에 모두 있는 종목은 한 번만 센다 —
 * 리포트에도 한 번만 실린다. 대소문자는 구분하지 않는다.
 */
export function countReportSymbols(
    holdings: readonly SymbolEntry[],
    watchlist: readonly SymbolEntry[]
): number {
    return new Set(
        [...holdings, ...watchlist].map(entry => entry.symbol.toUpperCase())
    ).size;
}

/**
 * 종목이 이미 메일 리포트 대상(보유∪관심)인지. 관심종목 판정은 `useWatchlist().has`에 맡긴다 —
 * 회원/비회원 출처와 낙관적 갱신을 그 훅이 이미 반영하고 있다.
 */
export function isInReportSet(
    symbol: string,
    holdings: readonly SymbolEntry[],
    isWatched: (symbol: string) => boolean
): boolean {
    const upper = symbol.toUpperCase();
    return (
        holdings.some(holding => holding.symbol.toUpperCase() === upper) ||
        isWatched(upper)
    );
}
