const FMP_SYMBOL_ALIASES: Readonly<Record<string, string>> = {
    'BRK.A': 'BRK-A',
    'BRK.B': 'BRK-B',
    'BF.A': 'BF-A',
    'BF.B': 'BF-B',
};

/**
 * Converts a SigLens ticker to FMP's provider-specific notation.
 *
 * US dual-class shares use a hyphen on FMP (`BRK.B` → `BRK-B`), but a raw
 * dot→hyphen replacement would corrupt FMP's international/exchange-suffixed
 * symbols (e.g. `VOD.L`, `7203.T`) and index symbols (`^SPX`). So, like
 * {@link toYahooSymbol}, this maps only verified aliases and passes everything
 * else through unchanged.
 */
export function toFmpSymbol(symbol: string): string {
    return FMP_SYMBOL_ALIASES[symbol] ?? symbol;
}
