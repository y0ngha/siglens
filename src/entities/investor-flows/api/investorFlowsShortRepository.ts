import 'server-only';
import { desc, eq, gte, sql } from 'drizzle-orm';
import { DB_TRANSIENT_RETRY } from '@/shared/db/isTransientDbError';
import { finraShortInterest, finraShortVolume } from '@/shared/db/schema';
import type { SiglensDatabase } from '@/shared/db/types';
import { withRetry } from '@/shared/lib/withRetry';
import {
    INVESTOR_FLOWS_PRUNE_BATCH_SIZE,
    INVESTOR_FLOWS_UPSERT_CHUNK_SIZE,
} from '../lib/investorFlowsPolicy';
import type { ShortInterestRow, ShortVolumeRow } from '../model';

/**
 * FINRA 공매도 데이터 저장소(⚠ 비상업 라이선스 — `shared/api/finra/finraShortDataEnabled.ts`).
 * 쓰기는 청크 upsert, 값이 바뀐 행만 갱신한다.
 */
export class DrizzleInvestorFlowsShortRepository {
    constructor(private readonly db: SiglensDatabase) {}

    async upsertShortVolume(rows: readonly ShortVolumeRow[]): Promise<void> {
        for (
            let i = 0;
            i < rows.length;
            i += INVESTOR_FLOWS_UPSERT_CHUNK_SIZE
        ) {
            const chunk = rows.slice(i, i + INVESTOR_FLOWS_UPSERT_CHUNK_SIZE);
            // react-doctor-disable-next-line react-doctor/async-await-in-loop
            await withRetry(
                () =>
                    this.db
                        .insert(finraShortVolume)
                        .values(chunk)
                        .onConflictDoUpdate({
                            target: [
                                finraShortVolume.symbol,
                                finraShortVolume.tradeDate,
                            ],
                            set: {
                                shortVolume: sql`excluded.short_volume`,
                                totalVolume: sql`excluded.total_volume`,
                            },
                            setWhere: sql`${finraShortVolume.shortVolume} IS DISTINCT FROM excluded.short_volume OR ${finraShortVolume.totalVolume} IS DISTINCT FROM excluded.total_volume`,
                        }),
                DB_TRANSIENT_RETRY
            );
        }
    }

    async upsertShortInterest(
        rows: readonly ShortInterestRow[]
    ): Promise<void> {
        for (
            let i = 0;
            i < rows.length;
            i += INVESTOR_FLOWS_UPSERT_CHUNK_SIZE
        ) {
            const chunk = rows.slice(i, i + INVESTOR_FLOWS_UPSERT_CHUNK_SIZE);
            // react-doctor-disable-next-line react-doctor/async-await-in-loop
            await withRetry(
                () =>
                    this.db
                        .insert(finraShortInterest)
                        .values(
                            chunk.map(row => ({
                                ...row,
                                // numeric 열은 문자열로 주고받는다.
                                daysToCover:
                                    row.daysToCover === null
                                        ? null
                                        : String(row.daysToCover),
                            }))
                        )
                        .onConflictDoUpdate({
                            target: [
                                finraShortInterest.symbol,
                                finraShortInterest.settlementDate,
                            ],
                            set: {
                                shortQty: sql`excluded.short_qty`,
                                prevShortQty: sql`excluded.prev_short_qty`,
                                avgDailyVolume: sql`excluded.avg_daily_volume`,
                                daysToCover: sql`excluded.days_to_cover`,
                            },
                            setWhere: sql`(${finraShortInterest.shortQty}, ${finraShortInterest.prevShortQty}, ${finraShortInterest.avgDailyVolume}, ${finraShortInterest.daysToCover}) IS DISTINCT FROM (excluded.short_qty, excluded.prev_short_qty, excluded.avg_daily_volume, excluded.days_to_cover)`,
                        }),
                DB_TRANSIENT_RETRY
            );
        }
    }

    /** `since`(포함) 이후 저장된 일별 거래량 거래일 집합 — `finra_short_volume_trade_date_idx`로 읽는다. */
    async listShortVolumeTradeDates(since: string): Promise<Set<string>> {
        const rows = await withRetry(
            () =>
                this.db
                    .selectDistinct({ tradeDate: finraShortVolume.tradeDate })
                    .from(finraShortVolume)
                    .where(gte(finraShortVolume.tradeDate, since)),
            DB_TRANSIENT_RETRY
        );
        return new Set(rows.map(row => row.tradeDate));
    }

    /**
     * 잔고·일별 거래량 중 어느 쪽이든 행이 하나라도 있는가 — 수급 탭의 "공매도 수집 중" 안내를 끄는 기준(FINRA 첫 수집이
     * 끝났다는 뜻). `LIMIT 1` 두 번이라 테이블 크기와 무관하게 싸다.
     */
    async hasAnyRow(): Promise<boolean> {
        const [volume] = await withRetry(
            () =>
                this.db
                    .select({ symbol: finraShortVolume.symbol })
                    .from(finraShortVolume)
                    .limit(1),
            DB_TRANSIENT_RETRY
        );
        if (volume !== undefined) return true;
        const [interest] = await withRetry(
            () =>
                this.db
                    .select({ symbol: finraShortInterest.symbol })
                    .from(finraShortInterest)
                    .limit(1),
            DB_TRANSIENT_RETRY
        );
        return interest !== undefined;
    }

    /** `since`(포함) 이후 저장된 결제일 집합. */
    async listShortInterestSettlementDates(
        since: string
    ): Promise<Set<string>> {
        const rows = await withRetry(
            () =>
                this.db
                    .selectDistinct({
                        settlementDate: finraShortInterest.settlementDate,
                    })
                    .from(finraShortInterest)
                    .where(gte(finraShortInterest.settlementDate, since)),
            DB_TRANSIENT_RETRY
        );
        return new Set(rows.map(row => row.settlementDate));
    }

    /** 일별 거래량 정리 — `RETURNING` 없이 영향 행 수만 읽고, ctid 배치로 지운다(수백만 행 방지). */
    async pruneShortVolumeBefore(cutoffDate: string): Promise<number> {
        let deleted = 0;
        for (;;) {
            // 배치는 직전 배치에 이어 직렬이다.
            // react-doctor-disable-next-line react-doctor/async-await-in-loop
            const result = await withRetry(
                () =>
                    this.db.execute(sql`
                        DELETE FROM finra_short_volume
                        WHERE ctid IN (
                            SELECT ctid FROM finra_short_volume
                            WHERE trade_date < ${cutoffDate}::date
                            LIMIT ${INVESTOR_FLOWS_PRUNE_BATCH_SIZE}
                        )`),
                DB_TRANSIENT_RETRY
            );
            const count = (result as { count?: number }).count ?? 0;
            deleted += count;
            if (count < INVESTOR_FLOWS_PRUNE_BATCH_SIZE) return deleted;
        }
    }

    async pruneShortInterestBefore(cutoffDate: string): Promise<number> {
        const result = await withRetry(
            () =>
                this.db.execute(
                    sql`DELETE FROM finra_short_interest WHERE settlement_date < ${cutoffDate}::date`
                ),
            DB_TRANSIENT_RETRY
        );
        return (result as { count?: number }).count ?? 0;
    }

    /** 심볼의 공매도 잔고 최근 `limit`건(최신순). */
    async findShortInterest(symbol: string, limit: number) {
        const rows = await withRetry(
            () =>
                this.db
                    .select()
                    .from(finraShortInterest)
                    .where(eq(finraShortInterest.symbol, symbol))
                    .orderBy(desc(finraShortInterest.settlementDate))
                    .limit(limit),
            DB_TRANSIENT_RETRY
        );
        return rows.map(row => ({
            settlementDate: row.settlementDate,
            shortQty: row.shortQty,
            avgDailyVolume: row.avgDailyVolume,
            daysToCover:
                row.daysToCover === null ? null : Number(row.daysToCover),
        }));
    }

    /** 심볼의 일별 공매도 거래량 최근 `limit`건(최신순). */
    async findShortVolume(symbol: string, limit: number) {
        const rows = await withRetry(
            () =>
                this.db
                    .select()
                    .from(finraShortVolume)
                    .where(eq(finraShortVolume.symbol, symbol))
                    .orderBy(desc(finraShortVolume.tradeDate))
                    .limit(limit),
            DB_TRANSIENT_RETRY
        );
        return rows.map(row => ({
            tradeDate: row.tradeDate,
            shortVolume: row.shortVolume,
            totalVolume: row.totalVolume,
        }));
    }
}
