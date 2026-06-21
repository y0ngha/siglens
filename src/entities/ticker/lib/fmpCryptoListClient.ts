/** Raw FMP cryptocurrency-list row (fields beyond these are ignored). */
export interface FmpCryptoListRaw {
    symbol?: string;
    name?: string;
    circulatingSupply?: number | null;
    [key: string]: unknown;
}

/** Normalized row for the crypto_assets table. */
export interface CryptoAssetRow {
    symbol: string;
    name: string;
    circulatingSupply: number | null;
}

/** Map a raw FMP list row; returns null when there is no usable symbol. */
export function mapCryptoListRow(raw: FmpCryptoListRaw): CryptoAssetRow | null {
    if (!raw.symbol) return null;
    return {
        symbol: raw.symbol,
        name: raw.name ?? raw.symbol,
        circulatingSupply:
            typeof raw.circulatingSupply === 'number'
                ? raw.circulatingSupply
                : null,
    };
}
