import 'server-only';
import { affectedRows } from './affectedRows';
import { isNotNull, sql } from 'drizzle-orm';
import { DB_TRANSIENT_RETRY } from '@/shared/db/isTransientDbError';
import { secFtd, secFtdFiles } from '@/shared/db/schema';
import type { SiglensDatabase } from '@/shared/db/types';
import { withRetry } from '@/shared/lib/withRetry';
import { INVESTOR_FLOWS_UPSERT_CHUNK_SIZE } from '../lib/investorFlowsPolicy';
import type { FtdFileState, FtdPointRecord, FtdRow } from '../model';
import { compositeKey } from '../lib/dedupeByKey';
import { warnWithDetail } from '@/shared/lib/warnWithDetail';
import { type UpsertLog, uniqueForUpsert } from './uniqueForUpsert';
import {
    readInvestorFlowsState,
    writeInvestorFlowsState,
} from './investorFlowsState';

/**
 * SEC fails-to-deliver 저장소. 반월 파일 하나의 행 저장과 "처리됨" 표시(`sec_ftd_files.processed_at`)는 **한 트랜잭션**이다 — 중간에
 * 죽으면 통째로 롤백되어 그 파일이 다음 실행에서 처음부터 다시 처리된다(DB-6). 저장하지 못한 파일은 `processed_at` NULL로
 * 시도 횟수만 남는다(`recordRejected`).
 */
export class DrizzleInvestorFlowsFtdRepository {
    constructor(
        private readonly db: SiglensDatabase,
        /** 중복 키를 줄였을 때의 경고(`uniqueForUpsert`) — 수집 cron은 자기 `log`를 넘긴다. */
        private readonly log: UpsertLog = warnWithDetail
    ) {}

    getState(key: string): Promise<string | null> {
        return readInvestorFlowsState(this.db, key);
    }

    setState(key: string, value: string): Promise<void> {
        return writeInvestorFlowsState(this.db, key, value);
    }

    /** 지금까지 본 반월 파일(`YYYYMMa|b`)의 상태 — 저장됐는지, 저장하지 못한 시도가 몇 번인지. */
    async listFileStates(): Promise<Map<string, FtdFileState>> {
        const rows = await withRetry(
            () =>
                this.db
                    .select({
                        fileKey: secFtdFiles.fileKey,
                        processedAt: secFtdFiles.processedAt,
                        attempts: secFtdFiles.attempts,
                    })
                    .from(secFtdFiles),
            DB_TRANSIENT_RETRY
        );
        return new Map(
            rows.map(row => [
                row.fileKey,
                { processed: row.processedAt !== null, attempts: row.attempts },
            ])
        );
    }

    /** 반월 파일이 하나라도 저장됐는가 — 수급 탭 "수집 중" 안내의 준비 상태(`loadInvestorFlowsPipelineReadiness`). */
    async hasAnyProcessedFile(): Promise<boolean> {
        const [row] = await withRetry(
            () =>
                this.db
                    .select({ fileKey: secFtdFiles.fileKey })
                    .from(secFtdFiles)
                    .where(isNotNull(secFtdFiles.processedAt))
                    .limit(1),
            DB_TRANSIENT_RETRY
        );
        return row !== undefined;
    }

    /** 저장하지 못한 파일을 기록하고 시도 횟수를 1 올린다(`processed_at`은 그대로 NULL). */
    async recordRejected(fileKey: string, error: string): Promise<void> {
        await withRetry(
            () =>
                this.db
                    .insert(secFtdFiles)
                    .values({ fileKey, attempts: 1, lastError: error })
                    .onConflictDoUpdate({
                        target: secFtdFiles.fileKey,
                        set: {
                            attempts: sql`${secFtdFiles.attempts} + 1`,
                            lastError: error,
                        },
                    }),
            DB_TRANSIENT_RETRY
        );
    }

    /** 파일 하나의 유니버스 행을 upsert하고 파일을 처리됨으로 표시한다(한 트랜잭션). */
    async storeFile(fileKey: string, rows: readonly FtdRow[]): Promise<void> {
        const unique = uniqueForUpsert(
            'sec_ftd',
            rows,
            row => compositeKey(row.cusip, row.settlementDate),
            this.log
        );
        await withRetry(
            () =>
                this.db.transaction(async tx => {
                    for (
                        let i = 0;
                        i < unique.length;
                        i += INVESTOR_FLOWS_UPSERT_CHUNK_SIZE
                    ) {
                        const chunk = unique.slice(
                            i,
                            i + INVESTOR_FLOWS_UPSERT_CHUNK_SIZE
                        );
                        // 한 트랜잭션 안이라 직렬이어야 한다.
                        // react-doctor-disable-next-line react-doctor/async-await-in-loop
                        await tx
                            .insert(secFtd)
                            .values(
                                chunk.map(row => ({
                                    ...row,
                                    // numeric 열은 문자열로 주고받는다.
                                    price:
                                        row.price === null
                                            ? null
                                            : String(row.price),
                                }))
                            )
                            .onConflictDoUpdate({
                                target: [secFtd.cusip, secFtd.settlementDate],
                                set: {
                                    symbol: sql`excluded.symbol`,
                                    failsQty: sql`excluded.fails_qty`,
                                    price: sql`excluded.price`,
                                },
                                setWhere: sql`(${secFtd.symbol}, ${secFtd.failsQty}, ${secFtd.price}) IS DISTINCT FROM (excluded.symbol, excluded.fails_qty, excluded.price)`,
                            });
                    }
                    await tx
                        .insert(secFtdFiles)
                        .values({
                            fileKey,
                            rowCount: unique.length,
                            processedAt: sql`now()`,
                        })
                        .onConflictDoUpdate({
                            target: secFtdFiles.fileKey,
                            set: {
                                rowCount: unique.length,
                                processedAt: sql`now()`,
                                lastError: null,
                            },
                        });
                }),
            DB_TRANSIENT_RETRY
        );
    }

    /** 보존 정리 — 결제일이 `cutoffDate`보다 이른 행. 지운 행 수. */
    async pruneBefore(cutoffDate: string): Promise<number> {
        return affectedRows(
            await withRetry(
                () =>
                    this.db.execute(
                        sql`DELETE FROM sec_ftd WHERE settlement_date < ${cutoffDate}::date`
                    ),
                DB_TRANSIENT_RETRY
            )
        );
    }

    /**
     * 심볼의 결제일별 FTD(`sinceDate` 이후, 오래된 순). 한 심볼이 CUSIP을 바꿨으면 같은 결제일의 행을 **합산**한다(가격은 큰 값).
     * 행이 없는 결제일은 실패가 없던 날이다(데이터 없음이 아니다).
     */
    async findFailsToDeliver(
        symbol: string,
        sinceDate: string
    ): Promise<FtdPointRecord[]> {
        const rows = await withRetry(
            () =>
                this.db.execute(sql`
                    SELECT settlement_date::text AS settlement_date,
                           sum(fails_qty)::bigint::text AS fails_qty,
                           max(price)::text AS price
                    FROM sec_ftd
                    WHERE symbol = ${symbol} AND settlement_date >= ${sinceDate}::date
                    GROUP BY settlement_date
                    ORDER BY settlement_date`),
            DB_TRANSIENT_RETRY
        );
        // 열은 위 SELECT가 정한 세 개이고 모두 `::text`로 읽는다(bigint·numeric의 정밀도를 드라이버가 바꾸지 않게) — 여기서 숫자로 옮긴다.
        return rows.map(row => ({
            settlementDate: String(row.settlement_date),
            failsQty: Number(row.fails_qty),
            price: row.price === null ? null : Number(row.price),
        }));
    }
}
