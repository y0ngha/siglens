import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { sql } from 'drizzle-orm';
import * as schema from '../src/shared/db/schema';
import { kstDateKey } from '../src/shared/lib/etTimeUtils';
import { guardRemoteWrite, readDatabaseUrl } from '../db/scripts/lib/dbTarget';
import {
    chunkRows,
    selectStaleSchedules,
    STALE_SCHEDULE_DELETE_CHUNK_SIZE,
    type UpcomingEarningsRow,
} from './lib/staleEarningsSchedules';

/**
 * `earnings_reports`의 옛 예정일 행 일회성 정리 —
 * `yarn db:prune:stale-earnings [--apply]`.
 *
 * 판정 규칙과 배경은 `scripts/lib/staleEarningsSchedules.ts` 머리말. 수집 경로
 * (`pruneSupersededUpcoming`)가 앞으로의 갱신은 정리하므로, 이 스크립트는 이미 쌓인
 * 행을 한 번 치우는 용도다.
 *
 * 기본은 **dry-run**이다 — 건수만 찍고 쓰지 않는다(심볼·행 목록도 찍지 않는다).
 * `--apply`일 때만 지우며, 쓰기 스크립트라 원격 대상이면 DB-4대로 거부한다
 * (`guardRemoteWrite`; 운영에는 `ALLOW_REMOTE_DB_WRITE=1`). 지운 심볼은 다음 조회 때
 * 24h 신선도 게이트를 따라 다시 받아 온다 — 남는 최신 예정일 행이 있으므로 그 사이에도
 * 다음 실적일은 비지 않는다.
 *
 * 삭제 문은 키 `(symbol, earnings_date)`에 더해 "실적 미발표" 조건을 다시 건다 — 조회와
 * 삭제 사이에 실적이 채워진 행은 지우지 않는다.
 */
const apply = process.argv.includes('--apply');
const { databaseUrl } = readDatabaseUrl();

async function run(): Promise<void> {
    if (apply) guardRemoteWrite(databaseUrl, 'db:prune:stale-earnings');
    else
        console.log(
            '[db] dry-run (default): no writes. Pass --apply to delete.'
        );

    const client = postgres(databaseUrl, { max: 1 });
    try {
        const db = drizzle(client, { schema });
        const today = kstDateKey(new Date());
        const raw = (await db.execute(sql`
            SELECT symbol, earnings_date::text AS earnings_date, fetched_at
            FROM earnings_reports
            WHERE earnings_date >= ${today}::date
              AND eps_actual IS NULL
              AND revenue_actual IS NULL`)) as unknown as {
            symbol: string;
            earnings_date: string;
            fetched_at: Date | string;
        }[];
        const rows: UpcomingEarningsRow[] = raw.map(r => ({
            symbol: r.symbol,
            earningsDate: r.earnings_date,
            fetchedAt: new Date(r.fetched_at),
        }));

        const selection = selectStaleSchedules(rows);
        console.log(
            JSON.stringify({
                today,
                scannedRows: selection.scannedRows,
                symbolsWithMultiple: selection.symbolsWithMultiple,
                symbolsAffected: selection.symbolsAffected,
                staleRows: selection.stale.length,
            })
        );
        if (!apply || selection.stale.length === 0) return;

        let deleted = 0;
        for (const chunk of chunkRows(
            selection.stale,
            STALE_SCHEDULE_DELETE_CHUNK_SIZE
        )) {
            const keys = sql.join(
                chunk.map(r => sql`(${r.symbol}, ${r.earningsDate}::date)`),
                sql`, `
            );
            const result = await db.execute(sql`
                DELETE FROM earnings_reports
                WHERE (symbol, earnings_date) IN (${keys})
                  AND eps_actual IS NULL
                  AND revenue_actual IS NULL`);
            deleted += (result as unknown as { count?: number }).count ?? 0;
        }
        console.log(JSON.stringify({ deletedRows: deleted }));
    } finally {
        await client.end();
    }
}

run().catch((error: unknown) => {
    console.error('prune-stale-earnings-schedules failed:', error);
    process.exit(1);
});
