import { fmpGet } from '@/shared/api/fmp/httpClient';

interface FmpQuoteNameRaw {
    symbol?: string;
    name?: string;
}

/** Resolve a crypto display name via FMP quote (profile is empty for crypto). Falls back to the symbol. */
export async function fetchCryptoQuoteName(symbol: string): Promise<string> {
    try {
        const rows = await fmpGet<FmpQuoteNameRaw[]>('quote', { symbol });
        return rows[0]?.name ?? symbol;
    } catch {
        return symbol;
    }
}
