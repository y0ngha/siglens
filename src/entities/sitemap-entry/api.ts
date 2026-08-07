import 'server-only';

import { cryptoAssets, koreanTickers } from '@/shared/db/schema';
import type { SiglensDatabase } from '@/shared/db/types';
import { and, asc, lt, notInArray, sql } from 'drizzle-orm';
import type { RemovalSitemapCandidateSource } from './model';

const cryptoSupplyOrder = sql`${cryptoAssets.circulatingSupply} DESC NULLS LAST`;

export class DrizzleRemovalSitemapCandidateSource implements RemovalSitemapCandidateSource {
    constructor(private readonly db: SiglensDatabase) {}

    async loadStockSymbolsBefore(
        cutoff: Date,
        excludedSymbols: readonly string[]
    ): Promise<readonly string[]> {
        const rows = await this.db
            .select({ symbol: koreanTickers.symbol })
            .from(koreanTickers)
            .where(
                and(
                    lt(koreanTickers.updatedAt, cutoff),
                    notInArray(koreanTickers.symbol, [...excludedSymbols])
                )
            )
            .orderBy(asc(koreanTickers.symbol));

        return rows.map(row => row.symbol);
    }

    async loadHistoricalCryptoSymbols(
        limit: number,
        excludedSymbols: readonly string[]
    ): Promise<readonly string[]> {
        const rows = await this.db
            .select({ symbol: cryptoAssets.symbol })
            .from(cryptoAssets)
            .where(notInArray(cryptoAssets.symbol, [...excludedSymbols]))
            .orderBy(cryptoSupplyOrder, asc(cryptoAssets.symbol))
            .limit(limit);

        return rows.map(row => row.symbol);
    }
}
