import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { sql } from 'drizzle-orm';
import * as schema from '../src/shared/db/schema';
import { Drizzle13fRepository } from '../src/entities/investor-flows/api/investorFlows13fRepository';
import {
    guardRemoteWrite,
    requireDatabaseUrl,
} from '../db/scripts/lib/dbTarget';
import { rebuildAggregates } from './lib/rebuildInvestorFlowsAggregates';

/**
 * 수급 13F 집계 전체 재계산 — `yarn investor-flows:rebuild-aggregates [--dry-run] [--reset]`.
 *
 * 흐름과 사용 시점은 `scripts/lib/rebuildInvestorFlowsAggregates.ts` 머리말과 `docs/reference/CRON.md`.
 * **쓰기 스크립트**라 DB-4대로 원격 대상이면 거부한다(`guardRemoteWrite`; 운영에는 `ALLOW_REMOTE_DB_WRITE=1`).
 * `--dry-run`은 쓰지 않으므로 가드를 거치지 않고 대상만 찍는다. `--reset`은 기준이 없는 분기의 변화 열을 먼저
 * NULL로 되돌린다(baseline 규칙을 엄격하게 바꾼 뒤).
 */
const dryRun = process.argv.includes('--dry-run');
const reset = process.argv.includes('--reset');
const databaseUrl = requireDatabaseUrl();

async function run(): Promise<void> {
    if (dryRun) console.log('[db] --dry-run: no writes');
    else guardRemoteWrite(databaseUrl, 'investor-flows:rebuild-aggregates');

    const client = postgres(databaseUrl, { max: 1 });
    try {
        const db = drizzle(client, { schema });
        const repo = new Drizzle13fRepository(db);
        const result = await rebuildAggregates(
            {
                listPeriods: async () => {
                    const rows = await db.execute(
                        sql`SELECT period::text AS period FROM sec_13f_positions UNION SELECT period::text FROM sec_13f_aggregates ORDER BY 1`
                    );
                    return (rows as unknown as { period: string }[]).map(
                        r => r.period
                    );
                },
                listCusips: async (period, afterCusip, limit) => {
                    const rows = await db.execute(sql`
                        SELECT cusip FROM (
                            SELECT m.cusip FROM sec_13f_positions p JOIN cusip_symbol_map m ON m.id = p.cusip_id WHERE p.period = ${period}::date
                            UNION
                            SELECT cusip FROM sec_13f_aggregates WHERE period = ${period}::date
                        ) c
                        WHERE cusip > ${afterCusip}
                        ORDER BY cusip
                        LIMIT ${limit}`);
                    return (rows as unknown as { cusip: string }[]).map(
                        r => r.cusip
                    );
                },
                countProcessedFilersForPeriod: p =>
                    repo.countProcessedFilersForPeriod(p),
                recomputeAggregates: (p, c, m) =>
                    repo.recomputeAggregates(p, c, m),
                resetAggregateChanges: p => repo.resetAggregateChanges(p),
                log: message => console.log(message),
            },
            { today: new Date().toISOString().slice(0, 10), dryRun, reset }
        );
        console.log(JSON.stringify(result));
    } finally {
        await client.end();
    }
}

run().catch((error: unknown) => {
    console.error('rebuild-aggregates failed:', error);
    process.exit(1);
});
