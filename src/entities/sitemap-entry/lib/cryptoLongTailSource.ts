import 'server-only';

import { POPULAR_CRYPTOS } from '@/shared/config/popular-cryptos';
import { cryptoAssets } from '@/shared/db/schema';
import type { SiglensDatabase } from '@/shared/db/types';
import { asc, notInArray, sql } from 'drizzle-orm';
import type { LongTailTickerSource } from '../model';

/**
 * Crypto longtail URL cap. FMP lists ~4,785 coins (most illiquid/dead) and
 * batch-crypto-quotes is plan-restricted, so we cap the sitemap to the top-N
 * by circulating supply rather than advertising the entire universe.
 */
export const CRYPTO_LONGTAIL_CAP = 1000;

const longTailPredicate = notInArray(cryptoAssets.symbol, [...POPULAR_CRYPTOS]);

// circulatingSupply DESC NULLS LAST, then symbol asc for a stable tiebreak.
const supplyRank = sql`${cryptoAssets.circulatingSupply} DESC NULLS LAST`;

export class DrizzleCryptoLongTailSource implements LongTailTickerSource {
    constructor(private readonly db: SiglensDatabase) {}

    async count(): Promise<number> {
        const rows = await this.db
            .select({ symbol: cryptoAssets.symbol })
            .from(cryptoAssets)
            .where(longTailPredicate)
            .limit(CRYPTO_LONGTAIL_CAP);
        return rows.length;
    }

    async loadPage(
        pageNumber: number,
        pageSize: number
    ): Promise<readonly string[]> {
        // Resolve the capped, ranked universe, then page within it.
        const offset = (pageNumber - 1) * pageSize;
        if (offset >= CRYPTO_LONGTAIL_CAP) return [];
        const limit = Math.min(pageSize, CRYPTO_LONGTAIL_CAP - offset);
        const rows = await this.db
            .select({ symbol: cryptoAssets.symbol })
            .from(cryptoAssets)
            .where(longTailPredicate)
            .orderBy(supplyRank, asc(cryptoAssets.symbol))
            .limit(limit)
            .offset(offset);
        return rows.map(r => r.symbol);
    }
}
