import { POPULAR_CRYPTOS } from '@/shared/config/popular-cryptos';
import * as schema from '@/shared/db/schema';
import type { SiglensDatabase } from '@/shared/db/types';
import type { RemoteCallback } from 'drizzle-orm/pg-proxy';
import { drizzle } from 'drizzle-orm/pg-proxy';
import { describe, expect, it } from 'vitest';
import {
    CRYPTO_LONGTAIL_CAP,
    DrizzleCryptoLongTailSource,
} from '../lib/cryptoLongTailSource';

interface CapturedQuery {
    sql: string;
    params: unknown[];
    method: 'all' | 'execute';
}

function normalizeSql(query: string): string {
    return query.replace(/\s+/g, ' ').trim().toLowerCase();
}

function makeSource(rows: unknown[][]): {
    source: DrizzleCryptoLongTailSource;
    captured: CapturedQuery[];
} {
    const captured: CapturedQuery[] = [];
    const callback: RemoteCallback = async (sql, params, method) => {
        captured.push({ sql, params, method });
        return { rows };
    };
    const db = drizzle(callback, { schema }) as unknown as SiglensDatabase;

    return {
        source: new DrizzleCryptoLongTailSource(db),
        captured,
    };
}

describe('CRYPTO_LONGTAIL_CAP', () => {
    it('caps the crypto longtail universe to a sane number of URLs', () => {
        expect(CRYPTO_LONGTAIL_CAP).toBeGreaterThan(0);
        expect(CRYPTO_LONGTAIL_CAP).toBeLessThanOrEqual(2000);
    });
});

describe('DrizzleCryptoLongTailSource', () => {
    describe('count()', () => {
        it('returns the real eligible count without the cap applied', async () => {
            // eligible universe is larger than CRYPTO_LONGTAIL_CAP
            const { source, captured } = makeSource([[4_785]]);

            await expect(source.count()).resolves.toBe(4_785);

            const query = captured[0]!;
            const sql = normalizeSql(query.sql);
            // Must use a COUNT aggregate — not a row fetch with .limit()
            expect(sql).toContain('count(distinct ');
            expect(sql).toContain('where "crypto_assets"."symbol" not in');
            expect(query.params).toContain(POPULAR_CRYPTOS[0]);
        });

        it('falls back to 0 when count returns no rows', async () => {
            const { source } = makeSource([]);

            await expect(source.count()).resolves.toBe(0);
        });

        it('excludes popular cryptos from the eligible count', async () => {
            const { source, captured } = makeSource([[100]]);

            await source.count();

            const query = captured[0]!;
            // Every popular crypto should appear as a bind param
            for (const sym of POPULAR_CRYPTOS) {
                expect(query.params).toContain(sym);
            }
        });

        it('does NOT apply CRYPTO_LONGTAIL_CAP as a LIMIT in the count query', async () => {
            const { source, captured } = makeSource([[4_785]]);

            await source.count();

            const query = captured[0]!;
            // The cap must not appear as a query param (it was used as .limit() before the fix)
            expect(query.params).not.toContain(CRYPTO_LONGTAIL_CAP);
        });
    });

    describe('loadPage()', () => {
        it('maps page rows to symbol strings', async () => {
            const { source } = makeSource([['LTCUSD'], ['AVAXUSD']]);

            await expect(source.loadPage(1, 100)).resolves.toEqual([
                'LTCUSD',
                'AVAXUSD',
            ]);
        });

        it('returns [] when offset >= CRYPTO_LONGTAIL_CAP (past the cap boundary)', async () => {
            const { source, captured } = makeSource([['LTCUSD']]);

            // pageNumber=2, pageSize=CRYPTO_LONGTAIL_CAP → offset = CRYPTO_LONGTAIL_CAP
            const result = await source.loadPage(2, CRYPTO_LONGTAIL_CAP);

            expect(result).toEqual([]);
            // No DB query should be issued for out-of-range offsets
            expect(captured).toHaveLength(0);
        });

        it('clamps the last page so total served never exceeds CRYPTO_LONGTAIL_CAP', async () => {
            // Simulate: cap=1000, pageSize=600, page=2 → offset=600, effective limit = min(600, 400) = 400
            // Drizzle params layout for non-zero offset: [...popularCryptos, limit, offset]
            const { source, captured } = makeSource([['LTCUSD']]);

            await source.loadPage(2, 600);

            const query = captured[0]!;
            const n = query.params.length;
            const limit = query.params[n - 2] as number;
            const offset = query.params[n - 1] as number;
            expect(offset).toBe(600); // (2-1)*600
            // limit must be clamped: min(600, 1000-600) = 400
            expect(limit).toBe(400);
        });

        it('loads page 1 with supply-rank ordering and excludes popular cryptos', async () => {
            // Drizzle omits OFFSET 0, so params layout for page 1: [...popularCryptos, limit]
            const { source, captured } = makeSource([['LTCUSD']]);

            await source.loadPage(1, CRYPTO_LONGTAIL_CAP);

            const query = captured[0]!;
            const sql = normalizeSql(query.sql);
            expect(sql).toContain('where "crypto_assets"."symbol" not in');
            expect(sql).toContain('order by');
            // Primary sort must be circulatingSupply DESC NULLS LAST
            expect(sql).toContain('desc nulls last');
            expect(sql).toContain('"crypto_assets"."circulating_supply"');
            // Secondary tiebreak: symbol asc
            expect(sql).toContain('"crypto_assets"."symbol" asc');
            // Drizzle omits OFFSET 0 — last param is the limit
            expect(query.params[query.params.length - 1]).toBe(
                CRYPTO_LONGTAIL_CAP
            );
            expect(query.params).toContain(POPULAR_CRYPTOS[0]);
        });

        it('returns rows in circulatingSupply DESC NULLS LAST order given seeded rows', async () => {
            // Seed: BTC has the highest supply, ETH second, UNKNOWN has null supply.
            // The mock returns rows in whatever order we inject — we verify the SQL
            // carries the correct ORDER BY clause so Postgres applies the sort.
            // Row layout matches DrizzleCryptoLongTailSource.loadPage() select: { symbol }.
            const { source, captured } = makeSource([
                ['ETHUSD'], // would be second by supply
                ['BTCUSD'], // would be first by supply
                ['UNKNOWNCOIN'], // null supply → NULLS LAST
            ]);

            await source.loadPage(1, CRYPTO_LONGTAIL_CAP);

            const query = captured[0]!;
            const normalized = normalizeSql(query.sql);
            // Verify the primary sort column and direction are present in the SQL
            expect(normalized).toContain(
                '"crypto_assets"."circulating_supply" desc nulls last'
            );
        });
    });
});
