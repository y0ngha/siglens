import 'server-only';

import { cryptoAssets, koreanTickers } from '@/shared/db/schema';
import type { SiglensDatabase } from '@/shared/db/types';
import { and, asc, lt, notInArray, sql } from 'drizzle-orm';
import type { RemovalSitemapCandidateSource } from './model';

const cryptoSupplyOrder = sql`${cryptoAssets.circulatingSupply} DESC NULLS LAST`;

/**
 * 제거 sitemap 후보를 DB에서 읽는 어댑터. 주식 쿼리는 심볼 순, 크립토 쿼리는 유통량 내림차순 뒤 심볼 순으로 정렬해 결정적이다.
 * `NOT IN`은 대소문자를 구분하므로 호출부가 결과를 한 번 더 대소문자 무시로 거른다.
 */
export class DrizzleRemovalSitemapCandidateSource implements RemovalSitemapCandidateSource {
    constructor(private readonly db: SiglensDatabase) {}

    /** `updatedAt`이 `cutoff` 이전인 한국 종목 심볼(제외 목록 제외). */
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

    /** 유통량 내림차순(NULL 마지막) 상위 `limit`개 크립토 심볼(제외 목록 제외). */
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
