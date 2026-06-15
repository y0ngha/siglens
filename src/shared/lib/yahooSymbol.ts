const YAHOO_SYMBOL_ALIASES: Readonly<Record<string, string>> = {
    'BRK.B': 'BRK-B',
};

/**
 * Converts a SigLens ticker to Yahoo's provider-specific notation.
 *
 * This intentionally uses verified aliases instead of replacing every dot:
 * Yahoo exchange suffixes such as `VOD.L` and `7203.T` require the dot.
 */
export function toYahooSymbol(symbol: string): string {
    return YAHOO_SYMBOL_ALIASES[symbol] ?? symbol;
}
