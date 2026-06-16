import type {
    Chamber,
    CongressTradesProvider,
    RawCongressTrade,
} from '@y0ngha/siglens-core';
import { CONGRESS_REVALIDATE_SECONDS } from '@/shared/config/time';
import { fmpGet } from './httpClient';

/**
 * Maps each `Chamber` value to its corresponding FMP /stable endpoint name.
 * Senate and House disclosures come from separate endpoints on the wire.
 */
const ENDPOINT: Record<Chamber, string> = {
    senate: 'senate-trades',
    house: 'house-trades',
};

/**
 * FMP adapter implementing core's `CongressTradesProvider`.
 *
 * Returns raw FMP wire rows — normalization (type→side, amount range parsing,
 * sentiment tagging) is handled later by core's `normalizeCongressTrades`.
 *
 * Why no error catch: `fmpGet` already surfaces FmpHttpError for non-2xx
 * responses. Swallowing would hide partial-data gaps during FMP outages.
 */
export class FmpCongressTradesClient implements CongressTradesProvider {
    async getTrades(
        symbol: string,
        chamber: Chamber,
        limit: number
    ): Promise<RawCongressTrade[]> {
        const upper = symbol.toUpperCase();
        const raw = await fmpGet<RawCongressTrade[]>(
            ENDPOINT[chamber],
            { symbol: upper },
            { revalidate: CONGRESS_REVALIDATE_SECONDS }
        );
        return Array.isArray(raw) ? raw.slice(0, limit) : [];
    }
}
