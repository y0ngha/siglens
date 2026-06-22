import 'server-only';

import { POPULAR_CRYPTOS } from '@/shared/config/popular-cryptos';
import { POPULAR_TICKERS } from '@/shared/config/popular-tickers';
import { cryptoAssets, koreanTickers } from '@/shared/db/schema';
import type { SiglensDatabase } from '@/shared/db/types';
import { asc, countDistinct, notInArray, sql } from 'drizzle-orm';
import type { LongTailTickerSource } from './model';

const longTailPredicate = notInArray(koreanTickers.symbol, [
    ...POPULAR_TICKERS,
]);

export class DrizzleLongTailTickerSource implements LongTailTickerSource {
    constructor(private readonly db: SiglensDatabase) {}

    async count(): Promise<number> {
        const [row] = await this.db
            .select({ total: countDistinct(koreanTickers.symbol) })
            .from(koreanTickers)
            .where(longTailPredicate);

        return row?.total ?? 0;
    }

    async loadPage(
        pageNumber: number,
        pageSize: number
    ): Promise<readonly string[]> {
        const rows = await this.db
            .selectDistinct({ symbol: koreanTickers.symbol })
            .from(koreanTickers)
            .where(longTailPredicate)
            .orderBy(asc(koreanTickers.symbol))
            .limit(pageSize)
            .offset((pageNumber - 1) * pageSize);

        return rows.map(row => row.symbol);
    }
}

/**
 * Crypto longtail URL cap. FMP lists ~4,785 coins (most illiquid/dead) and
 * batch-crypto-quotes is plan-restricted, so we cap the sitemap to the top-N
 * by circulating supply rather than advertising the entire universe.
 */
export const CRYPTO_LONGTAIL_CAP = 1000;

const cryptoLongTailPredicate = notInArray(cryptoAssets.symbol, [
    ...POPULAR_CRYPTOS,
]);

// Drizzle's desc() helper does not emit NULLS LAST; raw sql is required to keep null supply last.
const supplyRank = sql`${cryptoAssets.circulatingSupply} DESC NULLS LAST`;

export class DrizzleCryptoLongTailSource implements LongTailTickerSource {
    constructor(private readonly db: SiglensDatabase) {}

    /**
     * Returns the TRUE eligible universe count (no cap applied).
     * `loadPage()` enforces CRYPTO_LONGTAIL_CAP for serving; this method
     * intentionally omits the cap so the route log can surface real drop counts.
     */
    async count(): Promise<number> {
        const [row] = await this.db
            .select({ total: countDistinct(cryptoAssets.symbol) })
            .from(cryptoAssets)
            .where(cryptoLongTailPredicate);

        return row?.total ?? 0;
    }

    async loadPage(
        pageNumber: number,
        pageSize: number
    ): Promise<readonly string[]> {
        const offset = (pageNumber - 1) * pageSize;
        if (offset >= CRYPTO_LONGTAIL_CAP) return [];
        const limit = Math.min(pageSize, CRYPTO_LONGTAIL_CAP - offset);
        const rows = await this.db
            .select({ symbol: cryptoAssets.symbol })
            .from(cryptoAssets)
            .where(cryptoLongTailPredicate)
            .orderBy(supplyRank, asc(cryptoAssets.symbol))
            .limit(limit)
            .offset(offset);
        return rows.map(r => r.symbol);
    }
}
