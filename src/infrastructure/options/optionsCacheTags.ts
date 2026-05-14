/** Cache tag covering every options-related fetch for a single symbol. */
export function optionsSymbolTag(symbol: string): string {
    return `options:${symbol}`;
}

/** Cache tag for one symbol × one expiration combination. */
export function optionsExpirationTag(symbol: string, expiry: string): string {
    return `options:${symbol}:${expiry}`;
}
