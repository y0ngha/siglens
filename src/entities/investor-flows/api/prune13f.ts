import 'server-only';
import { sql, type SQL } from 'drizzle-orm';
import { DB_TRANSIENT_RETRY } from '@/shared/db/isTransientDbError';
import type { SiglensDatabase } from '@/shared/db/types';
import { withRetry } from '@/shared/lib/withRetry';
import { INVESTOR_FLOWS_PRUNE_BATCH_SIZE } from '../lib/investorFlowsPolicy';
import { affectedRows } from './affectedRows';

/**
 * 보존 하한보다 이른 분기의 포지션을 **배치로** 지운다(집계는 남는다) — 주식 포지션 다음 옵션 포지션(같은 보존 규칙).
 * `RETURNING`을 쓰지 않고 드라이버의 영향 행 수만 읽는다(수백만 행을 메모리에 올리지 않는다). 한 배치는
 * `INVESTOR_FLOWS_PRUNE_BATCH_SIZE`행을 ctid로 지운다 — `period < floor`는 BRIN 인덱스가 받친다. `shouldStop`이 true가 되면
 * 멈추고 `done=false`(두 테이블을 다 비워야 `done`).
 */
export async function prunePositionsBefore(
    db: SiglensDatabase,
    floor: string,
    shouldStop: () => boolean
): Promise<{ deleted: number; done: boolean }> {
    const stock = await pruneBatchesBefore(
        db,
        sql`sec_13f_positions`,
        floor,
        shouldStop
    );
    if (!stock.done) return stock;
    const options = await pruneBatchesBefore(
        db,
        sql`sec_13f_option_positions`,
        floor,
        shouldStop
    );
    return {
        deleted: stock.deleted + options.deleted,
        done: options.done,
    };
}

async function pruneBatchesBefore(
    db: SiglensDatabase,
    table: SQL,
    floor: string,
    shouldStop: () => boolean
): Promise<{ deleted: number; done: boolean }> {
    let deleted = 0;
    for (;;) {
        if (shouldStop()) return { deleted, done: false };
        // 배치는 직전 배치의 삭제에 이어 직렬이다.
        // react-doctor-disable-next-line react-doctor/async-await-in-loop
        const result = await withRetry(
            () =>
                db.execute(sql`
                    DELETE FROM ${table}
                    WHERE ctid IN (
                        SELECT ctid FROM ${table}
                        WHERE period < ${floor}::date
                        LIMIT ${INVESTOR_FLOWS_PRUNE_BATCH_SIZE}
                    )`),
            DB_TRANSIENT_RETRY
        );
        const count = affectedRows(result);
        deleted += count;
        if (count < INVESTOR_FLOWS_PRUNE_BATCH_SIZE)
            return { deleted, done: true };
    }
}

/** 오래된 분기 집계를 지운다 — 주식 집계와 옵션 집계(같은 36개월 보존). 지운 행 수의 합. */
export async function pruneAggregatesBefore(
    db: SiglensDatabase,
    cutoffPeriod: string
): Promise<number> {
    const stock = affectedRows(
        await withRetry(
            () =>
                db.execute(
                    sql`DELETE FROM sec_13f_aggregates WHERE period < ${cutoffPeriod}::date`
                ),
            DB_TRANSIENT_RETRY
        )
    );
    const options = affectedRows(
        await withRetry(
            () =>
                db.execute(
                    sql`DELETE FROM sec_13f_option_aggregates WHERE period < ${cutoffPeriod}::date`
                ),
            DB_TRANSIENT_RETRY
        )
    );
    return stock + options;
}

/** 오래된 제출 원장 행을 지운다(멱등 판정에 더는 필요 없는 옛 제출일). */
export async function pruneFilingsBefore(
    db: SiglensDatabase,
    cutoffDate: string
): Promise<number> {
    return affectedRows(
        await withRetry(
            () =>
                db.execute(
                    sql`DELETE FROM sec_13f_filings WHERE filing_date < ${cutoffDate}::date`
                ),
            DB_TRANSIENT_RETRY
        )
    );
}
