import { fmpGet } from '@/shared/api/fmp/httpClient';

/** Raw FMP cryptocurrency-list row (fields beyond these are ignored). */
interface FmpCryptoListRaw {
    symbol?: string;
    name?: string;
    circulatingSupply?: number | null;
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

/** Fetch the full FMP cryptocurrency universe and map to crypto_assets rows. */
export async function fetchCryptoAssetList(): Promise<CryptoAssetRow[]> {
    const raw = await fmpGet<FmpCryptoListRaw[]>('cryptocurrency-list', {});
    return raw
        .map(mapCryptoListRow)
        .filter((r): r is CryptoAssetRow => r !== null);
}
