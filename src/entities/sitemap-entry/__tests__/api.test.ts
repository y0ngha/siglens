import { drizzle } from 'drizzle-orm/pg-proxy';
import type { RemoteCallback } from 'drizzle-orm/pg-proxy';
import { describe, expect, it } from 'vitest';
import { POPULAR_TICKERS } from '@/shared/config/popular-tickers';
import * as schema from '@/shared/db/schema';
import type { SiglensDatabase } from '@/shared/db/types';
import { DrizzleLongTailTickerSource } from '../api';

interface CapturedQuery {
    sql: string;
    params: unknown[];
    method: 'all' | 'execute';
}

function normalizeSql(query: string): string {
    return query.replace(/\s+/g, ' ').trim().toLowerCase();
}

function makeSource(rows: unknown[][]): {
    source: DrizzleLongTailTickerSource;
    captured: CapturedQuery[];
} {
    const captured: CapturedQuery[] = [];
    const callback: RemoteCallback = async (sql, params, method) => {
        captured.push({ sql, params, method });
        return { rows };
    };
    const db = drizzle(callback, { schema }) as unknown as SiglensDatabase;

    return {
        source: new DrizzleLongTailTickerSource(db),
        captured,
    };
}

describe('DrizzleLongTailTickerSource', () => {
    it('counts distinct uppercase long-tail symbols and excludes popular tickers', async () => {
        const { source, captured } = makeSource([[24_001]]);

        await expect(source.count()).resolves.toBe(24_001);

        const query = captured[0]!;
        const sql = normalizeSql(query.sql);
        expect(sql).toContain('count(distinct upper(');
        expect(sql).toContain('where upper("korean_tickers"."symbol") not in');
        expect(query.params).toContain(POPULAR_TICKERS[0]);
    });

    it('maps page rows to symbol strings', async () => {
        const { source } = makeSource([['AAA'], ['BBB']]);

        await expect(source.loadPage(1, 2)).resolves.toEqual(['AAA', 'BBB']);
    });

    it('loads page 3 with stable uppercase distinct ordering and pagination params', async () => {
        const { source, captured } = makeSource([['AAA'], ['BBB']]);

        await source.loadPage(3, 2_000);

        const query = captured[0]!;
        const sql = normalizeSql(query.sql);
        expect(sql).toContain('select distinct upper(');
        expect(sql).toContain('where upper("korean_tickers"."symbol") not in');
        expect(sql).toContain('order by upper("korean_tickers"."symbol") asc');
        expect(query.params).toContain(POPULAR_TICKERS[0]);
        expect(query.params.slice(-2)).toEqual([2_000, 4_000]);
    });

    it('falls back to 0 when count returns no rows', async () => {
        const { source } = makeSource([]);

        await expect(source.count()).resolves.toBe(0);
    });
});
