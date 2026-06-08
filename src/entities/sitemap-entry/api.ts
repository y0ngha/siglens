import 'server-only';

import { asc, countDistinct, notInArray, sql } from 'drizzle-orm';
import { POPULAR_TICKERS } from '@/shared/config/popular-tickers';
import { koreanTickers } from '@/shared/db/schema';
import type { SiglensDatabase } from '@/shared/db/types';
import type { LongTailTickerSource } from './model';

const normalizedSymbol = sql<string>`upper(${koreanTickers.symbol})`;
const longTailPredicate = notInArray(normalizedSymbol, [...POPULAR_TICKERS]);

export class DrizzleLongTailTickerSource implements LongTailTickerSource {
    constructor(private readonly db: SiglensDatabase) {}

    async count(): Promise<number> {
        const [row] = await this.db
            .select({ total: countDistinct(normalizedSymbol) })
            .from(koreanTickers)
            .where(longTailPredicate);

        return row?.total ?? 0;
    }

    async loadPage(
        pageNumber: number,
        pageSize: number
    ): Promise<readonly string[]> {
        const rows = await this.db
            .selectDistinct({ symbol: normalizedSymbol })
            .from(koreanTickers)
            .where(longTailPredicate)
            .orderBy(asc(normalizedSymbol))
            .limit(pageSize)
            .offset((pageNumber - 1) * pageSize);

        return rows.map(row => row.symbol);
    }
}
