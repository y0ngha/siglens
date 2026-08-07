import * as schema from '@/shared/db/schema';
import type { SiglensDatabase } from '@/shared/db/types';
import type { RemoteCallback } from 'drizzle-orm/pg-proxy';
import { drizzle } from 'drizzle-orm/pg-proxy';
import { describe, expect, it } from 'vitest';
import { DrizzleRemovalSitemapCandidateSource } from '../api';

interface CapturedQuery {
    sql: string;
    params: unknown[];
    method: 'all' | 'execute';
}

function normalizeSql(query: string): string {
    return query.replace(/\s+/g, ' ').trim().toLowerCase();
}

function makeSource(rows: unknown[][]): {
    source: DrizzleRemovalSitemapCandidateSource;
    captured: CapturedQuery[];
} {
    const captured: CapturedQuery[] = [];
    const callback: RemoteCallback = async (sql, params, method) => {
        captured.push({ sql, params, method });
        return { rows };
    };
    const db = drizzle(callback, { schema }) as unknown as SiglensDatabase;

    return {
        source: new DrizzleRemovalSitemapCandidateSource(db),
        captured,
    };
}

describe('DrizzleRemovalSitemapCandidateSource', () => {
    describe('when loading stock symbols before a cutoff', () => {
        it('maps rows and builds a cutoff, exclusion, and stable-order query', async () => {
            const cutoff = new Date('2026-06-15T08:36:58.000Z');
            const excludedSymbols = ['AAPL', 'BTCUSD'];
            const { source, captured } = makeSource([['AAA'], ['BBB']]);

            await expect(
                source.loadStockSymbolsBefore(cutoff, excludedSymbols)
            ).resolves.toEqual(['AAA', 'BBB']);

            const query = captured[0]!;
            const sql = normalizeSql(query.sql);
            expect(sql).toContain('"korean_tickers"."updated_at" <');
            expect(sql).toContain('"korean_tickers"."symbol" not in');
            expect(sql).toContain('order by "korean_tickers"."symbol" asc');
            expect(query.params).toContain(cutoff.toISOString());
            expect(query.params).toEqual(
                expect.arrayContaining(excludedSymbols)
            );
        });
    });

    describe('when loading historical crypto symbols', () => {
        it('maps rows and builds a supply-ranked, excluded, limited query', async () => {
            const excludedSymbols = ['BTCUSD'];
            const { source, captured } = makeSource([['ETHUSD'], ['SOLUSD']]);

            await expect(
                source.loadHistoricalCryptoSymbols(1_000, excludedSymbols)
            ).resolves.toEqual(['ETHUSD', 'SOLUSD']);

            const query = captured[0]!;
            const sql = normalizeSql(query.sql);
            expect(sql).toContain('"crypto_assets"."symbol" not in');
            expect(sql).toContain(
                'order by "crypto_assets"."circulating_supply" desc nulls last, "crypto_assets"."symbol" asc'
            );
            expect(sql).toContain('limit');
            expect(query.params).toContain(excludedSymbols[0]);
            expect(query.params).toContain(1_000);
        });
    });
});
