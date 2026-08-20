/** FMP search-symbol/search-name response row. */
export interface FmpSearchResult {
    symbol: string;
    name: string;
    currency: string;
    exchangeFullName: string;
    exchange: string;
}

/** Translator input — symbol + canonical English name. */
export interface TranslatorEntry {
    symbol: string;
    name: string;
}

/** Resolved Gemini-translator config (see `lib/config.ts`). */
export interface TranslatorConfig {
    apiKey: string;
    model: string;
}
