/** Cache tag covering every options-related fetch for a single symbol. */
export function optionsSymbolTag(symbol: string): string {
    return `options:${symbol}`;
}
