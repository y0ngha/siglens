import type {
    SectorSignalsResult,
    StockSignalResult,
} from '@y0ngha/siglens-core';

/**
 * Summarised sector signal data for the SSR crawl-text layer.
 * One entry per sector ETF symbol that has at least one signal.
 */
export interface SectorFact {
    /** Sector ETF symbol (e.g. `'XLK'`). */
    readonly sectorSymbol: string;
    /** Total number of stocks with at least one bullish signal. */
    readonly bullishCount: number;
    /** Total number of stocks with at least one bearish signal. */
    readonly bearishCount: number;
    /** Up to 3 top stock symbols in this sector (by bullish-first, then alphabetical). */
    readonly topSymbols: readonly string[];
}

const MAX_TOP_SYMBOLS = 3;

function isBullish(stock: StockSignalResult): boolean {
    return stock.signals.some(s => s.direction === 'bullish');
}

function isBearish(stock: StockSignalResult): boolean {
    return stock.signals.some(s => s.direction === 'bearish');
}

/**
 * Converts a `SectorSignalsResult` into per-sector summary facts for the
 * SSR SEO crawl-text layer (`SectorFactsSummary`).
 *
 * Pure function — no side effects, no time/random dependencies.
 *
 * - Stocks are grouped by `sectorSymbol`.
 * - `bullishCount` / `bearishCount`: stocks with ≥1 signal of each direction.
 * - `topSymbols`: up to 3 symbols; bullish stocks come first, then alphabetical.
 * - Sectors with no stocks are omitted.
 * - Empty input returns an empty array.
 */
export function buildSectorFacts(
    data: SectorSignalsResult
): readonly SectorFact[] {
    if (data.stocks.length === 0) return [];

    // Group stocks by sectorSymbol using a mutable accumulator for O(N) performance.
    const grouped = data.stocks.reduce<Map<string, StockSignalResult[]>>(
        (acc, stock) => {
            const existing = acc.get(stock.sectorSymbol);
            if (existing) {
                existing.push(stock);
            } else {
                acc.set(stock.sectorSymbol, [stock]);
            }
            return acc;
        },
        new Map()
    );

    const facts = [...grouped].map(([sectorSymbol, stocks]) => {
        const bullishStocks = stocks.filter(isBullish);
        const bearishStocks = stocks.filter(isBearish);
        const bullishCount = bullishStocks.length;
        const bearishCount = bearishStocks.length;

        // Top symbols: bullish first, then bearish-only, both sorted alphabetically within group.
        // Locale pinned to 'en' for environment-independent stable ordering.
        const bullishSymbols = bullishStocks
            .map(s => s.symbol)
            .toSorted((a, b) => a.localeCompare(b, 'en'));
        const bearishOnlySymbols = bearishStocks
            .filter(s => !isBullish(s))
            .map(s => s.symbol)
            .toSorted((a, b) => a.localeCompare(b, 'en'));
        const topSymbols = [...bullishSymbols, ...bearishOnlySymbols].slice(
            0,
            MAX_TOP_SYMBOLS
        );

        return { sectorSymbol, bullishCount, bearishCount, topSymbols };
    });

    // Sort sectors alphabetically for stable output (locale pinned to 'en')
    return facts.toSorted((a, b) =>
        a.sectorSymbol.localeCompare(b.sectorSymbol, 'en')
    );
}
