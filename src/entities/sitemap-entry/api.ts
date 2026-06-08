import 'server-only';

import { POPULAR_TICKERS } from '@/shared/config/popular-tickers';
import { koreanTickers } from '@/shared/db/schema';
import type { SiglensDatabase } from '@/shared/db/types';
import { asc, countDistinct, notInArray } from 'drizzle-orm';
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
