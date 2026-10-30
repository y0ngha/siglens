import 'server-only';
import {
    and,
    countDistinct,
    eq,
    gte,
    inArray,
    isNotNull,
    isNull,
    max,
    sql,
} from 'drizzle-orm';
import { DB_TRANSIENT_RETRY } from '@/shared/db/isTransientDbError';
import {
    cusipSymbolMap,
    investorFlowsState,
    sec13fDirtyAggregates,
    sec13fFilings,
    sec13fPositions,
} from '@/shared/db/schema';
import type { SiglensDatabase } from '@/shared/db/types';
import { warnWithDetail } from '@/shared/lib/warnWithDetail';
import { withRetry } from '@/shared/lib/withRetry';
import { INVESTOR_FLOWS_UPSERT_CHUNK_SIZE } from '../lib/investorFlowsPolicy';
import { chunked } from '../lib/chunked';
import type { AmendmentFiling } from '../lib/amendmentPlan';
import { cikToInt, cikToString } from '../lib/cik';
import { previousQuarterEnd } from '../lib/investorFlowsDates';
import type { AmendmentType, FilingRecord } from '../model';
import {
    buildAggregateDeleteSql,
    buildAggregateUpsertSql,
    buildBaselinelessAggregateUpsertSql,
    buildOptionAggregateDeleteSql,
    buildOptionAggregateUpsertSql,
    buildResetChangesSql,
    type AggregateMode,
} from './aggregateSql';
import { affectedRows } from './affectedRows';
import { applyFiling, type ApplyFilingInput } from './apply13fFiling';
import {
    pruneAggregatesBefore,
    pruneFilingsBefore,
    prunePositionsBefore,
    type PruneResult,
} from './prune13f';
import type { UpsertLog } from './uniqueForUpsert';

const FILING_LOOKUP_CHUNK = 1_000;

/** 실패(재시도 대기) 기록에 필요한 값. */
export interface FilingFailureInput {
    accession: string;
    cik: string;
    filingDate: string;
    submissionType: string;
}

export interface PendingFiling {
    accession: string;
    cik: string;
    filingDate: string;
    submissionType: string;
}

/** 집계를 다시 계산할 (period, cusip) 묶음 — 가장 오래된 분기부터. */
export interface DirtyBatch {
    period: string;
    entries: { id: number; cusip: string; symbol: string }[];
}

/**
 * 13F 수집 저장소 — 제출 원장(멱등·재시도 큐), 필러, 포지션, dirty 큐, 집계, 보존 정리.
 *
 * 큰 테이블이라 모든 쓰기는 청크로 나눈다(`INVESTOR_FLOWS_UPSERT_CHUNK_SIZE`). 제출 하나의 반영
 * (포지션 + dirty 표시 + 필러 + "처리됨" 표시)은 **한 트랜잭션**이다 — 중간에 죽으면 통째로 롤백되어 같은
 * accession이 다시 처리 대상이 되고, 커밋됐다면 dirty 행도 함께 남아 집계 재계산이 유실되지 않는다.
 */
export class Drizzle13fRepository {
    constructor(
        private readonly db: SiglensDatabase,
        /** 중복 키를 줄였을 때의 경고(`uniqueForUpsert`) — 수집 cron은 자기 `log`를 넘긴다. */
        private readonly log: UpsertLog = warnWithDetail
    ) {}

    /** 이미 기록된 accession들의 상태. 반영 완료(`processedAt`)와 실패(`attempts`)를 구분한다. */
    async findFilings(
        accessions: readonly string[]
    ): Promise<Map<string, FilingRecord>> {
        const found = new Map<string, FilingRecord>();
        for (const chunk of chunked(accessions, FILING_LOOKUP_CHUNK)) {
            // 청크 직렬 실행은 의도다 — DB 커넥션 하나를 한꺼번에 두드리지 않는다.
            // react-doctor-disable-next-line react-doctor/async-await-in-loop
            const rows = await withRetry(
                () =>
                    this.db
                        .select()
                        .from(sec13fFilings)
                        .where(inArray(sec13fFilings.accession, chunk)),
                DB_TRANSIENT_RETRY
            );
            for (const row of rows) {
                found.set(row.accession, {
                    accession: row.accession,
                    cik: cikToString(row.cik),
                    period: row.period,
                    filingDate: row.filingDate,
                    submissionType: row.submissionType,
                    amendmentType: row.amendmentType as AmendmentType | null,
                    attempts: row.attempts,
                    processedAt: row.processedAt,
                });
            }
        }
        return found;
    }

    /** 기록된 제출 중 가장 늦은 제출일 — 일일 커서의 출발점이다. 없으면 null. */
    async latestFilingDate(): Promise<string | null> {
        const [row] = await withRetry(
            () =>
                this.db
                    .select({ latest: max(sec13fFilings.filingDate) })
                    .from(sec13fFilings),
            DB_TRANSIENT_RETRY
        );
        return row?.latest ?? null;
    }

    /** 아직 반영되지 못했고 시도 횟수가 남은 제출들(오래된 순). */
    async listPendingRetries(
        maxAttempts: number,
        limit: number
    ): Promise<PendingFiling[]> {
        const rows = await withRetry(
            () =>
                this.db
                    .select({
                        accession: sec13fFilings.accession,
                        cik: sec13fFilings.cik,
                        filingDate: sec13fFilings.filingDate,
                        submissionType: sec13fFilings.submissionType,
                    })
                    .from(sec13fFilings)
                    .where(
                        and(
                            isNull(sec13fFilings.processedAt),
                            sql`${sec13fFilings.attempts} < ${maxAttempts}`
                        )
                    )
                    .orderBy(sec13fFilings.filingDate)
                    .limit(limit),
            DB_TRANSIENT_RETRY
        );
        return rows.map(row => ({ ...row, cik: cikToString(row.cik) }));
    }

    /** 시도를 소진해 영구 실패로 남은 제출 수 — backlog 경고용. */
    async countExhaustedFailures(maxAttempts: number): Promise<number> {
        const [row] = await withRetry(
            () =>
                this.db
                    .select({ n: sql<number>`count(*)::int` })
                    .from(sec13fFilings)
                    .where(
                        and(
                            isNull(sec13fFilings.processedAt),
                            gte(sec13fFilings.attempts, maxAttempts)
                        )
                    ),
            DB_TRANSIENT_RETRY
        );
        return row?.n ?? 0;
    }

    /** 실패를 기록하고 시도 횟수를 1 올린다(없으면 새로 만든다). */
    async recordFailure(
        filing: FilingFailureInput,
        error: string
    ): Promise<void> {
        await withRetry(
            () =>
                this.db
                    .insert(sec13fFilings)
                    .values({
                        ...filing,
                        cik: cikToInt(filing.cik),
                        attempts: 1,
                        lastError: error,
                    })
                    .onConflictDoUpdate({
                        target: sec13fFilings.accession,
                        set: {
                            attempts: sql`${sec13fFilings.attempts} + 1`,
                            lastError: error,
                        },
                    }),
            DB_TRANSIENT_RETRY
        );
    }

    /** 같은 (cik, period)에 이미 반영된 제출들 — 정정 규칙(`planPositionApplication`)의 입력. */
    async findProcessedFilings(
        cik: string,
        period: string
    ): Promise<AmendmentFiling[]> {
        const rows = await withRetry(
            () =>
                this.db
                    .select({
                        accession: sec13fFilings.accession,
                        filingDate: sec13fFilings.filingDate,
                        submissionType: sec13fFilings.submissionType,
                        amendmentType: sec13fFilings.amendmentType,
                    })
                    .from(sec13fFilings)
                    .where(
                        and(
                            eq(sec13fFilings.cik, cikToInt(cik)),
                            eq(sec13fFilings.period, period),
                            isNotNull(sec13fFilings.processedAt)
                        )
                    ),
            DB_TRANSIENT_RETRY
        );
        return rows.map(row => ({
            ...row,
            amendmentType: row.amendmentType as AmendmentType | null,
        }));
    }

    /**
     * 이 (cik, period)의 포지션이 하나라도 저장돼 있는가. 원장 행 없이 포지션이 있다면 **재수집**(`reingest-13f`가 원장을
     * 지웠다)이다 — 그때 원본 제출을 `replace`로 반영하면 이미 병합된 정정(NEW HOLDINGS) 행까지 지워진다.
     */
    async hasPositions(cik: string, period: string): Promise<boolean> {
        const rows = await withRetry(
            () =>
                this.db
                    .select({ one: sql<number>`1` })
                    .from(sec13fPositions)
                    .where(
                        and(
                            eq(sec13fPositions.cik, cikToInt(cik)),
                            eq(sec13fPositions.period, period)
                        )
                    )
                    .limit(1),
            DB_TRANSIENT_RETRY
        );
        return rows.length > 0;
    }

    /** 그 분기에 제출이 반영된 서로 다른 필러 수 — 직전 분기를 비교 기준으로 쓸 수 있는지 판정한다. */
    async countProcessedFilersForPeriod(period: string): Promise<number> {
        const [row] = await withRetry(
            () =>
                this.db
                    .select({ n: countDistinct(sec13fFilings.cik) })
                    .from(sec13fFilings)
                    .where(
                        and(
                            eq(sec13fFilings.period, period),
                            isNotNull(sec13fFilings.processedAt)
                        )
                    ),
            DB_TRANSIENT_RETRY
        );
        return row?.n ?? 0;
    }

    /** 제출 하나를 한 트랜잭션으로 반영한다(모드별 규칙은 `applyFiling` 참고). 값이 바뀌어 쓴 CUSIP들을 돌려준다. */
    applyFiling(input: ApplyFilingInput): Promise<string[]> {
        return applyFiling(this.db, this.log, input);
    }

    /**
     * 한 분기의 모든 CUSIP을 dirty로 표시한다(SQL 쪽에서 — 메모리에 올리지 않는다). 분기가 진행 중 → 완결로 넘어가거나
     * baseline 판정이 바뀌어 **계산 모드가 달라졌을 때** 그 분기 집계 전체를 다시 계산하게 하는 용도다. 표시한 행 수.
     */
    async markPeriodDirty(period: string): Promise<number> {
        const result = await withRetry(
            () =>
                this.db.execute(sql`
                    INSERT INTO sec_13f_dirty_aggregates (period, cusip_id)
                    SELECT DISTINCT ${period}::date, cusip_id FROM sec_13f_positions
                    WHERE period = ${period}::date
                    ON CONFLICT DO NOTHING`),
            DB_TRANSIENT_RETRY
        );
        return affectedRows(result);
    }

    /** 가장 오래된 분기의 dirty (period, cusip) 최대 `limit`개. 없으면 null. */
    async takeDirty(limit: number): Promise<DirtyBatch | null> {
        const [first] = await withRetry(
            () =>
                this.db
                    .select({
                        period: sql<string>`min(${sec13fDirtyAggregates.period})::text`,
                    })
                    .from(sec13fDirtyAggregates),
            DB_TRANSIENT_RETRY
        );
        if (!first?.period) return null;
        const rows = await withRetry(
            () =>
                this.db
                    .select({
                        id: cusipSymbolMap.id,
                        cusip: cusipSymbolMap.cusip,
                        symbol: cusipSymbolMap.symbol,
                    })
                    .from(sec13fDirtyAggregates)
                    .innerJoin(
                        cusipSymbolMap,
                        eq(cusipSymbolMap.id, sec13fDirtyAggregates.cusipId)
                    )
                    .where(eq(sec13fDirtyAggregates.period, first.period))
                    .orderBy(cusipSymbolMap.id)
                    .limit(limit),
            DB_TRANSIENT_RETRY
        );
        if (rows.length === 0) {
            // map에 없는 id만 남은 고아 dirty — 영원히 안 비워지는 루프를 막기 위해 지운다.
            await this.db
                .delete(sec13fDirtyAggregates)
                .where(eq(sec13fDirtyAggregates.period, first.period));
            return this.takeDirty(limit);
        }
        return { period: first.period, entries: rows };
    }

    /** 재계산이 **커밋된 뒤에** 읽어 간 dirty 행을 지운다. */
    async clearDirty(period: string, ids: readonly number[]): Promise<void> {
        if (ids.length === 0) return;
        await withRetry(
            () =>
                this.db
                    .delete(sec13fDirtyAggregates)
                    .where(
                        and(
                            eq(sec13fDirtyAggregates.period, period),
                            inArray(sec13fDirtyAggregates.cusipId, [...ids])
                        )
                    ),
            DB_TRANSIENT_RETRY
        );
    }

    /**
     * (period, cusips) 집계를 다시 계산한다. `mode`는 비교 정의(`aggregateSql.ts`): `complete`(전체 대 전체),
     * `panel`(진행 중 분기, 양 분기 필러만), `none`(비교 기준 없음 — 수량만, 변화 열 NULL). 옵션 집계(풋·콜)도 함께 다시 쓴다.
     */
    async recomputeAggregates(
        period: string,
        cusips: readonly string[],
        mode: AggregateMode
    ): Promise<void> {
        const prevPeriod = previousQuarterEnd(period);
        for (const chunk of chunked(cusips, INVESTOR_FLOWS_UPSERT_CHUNK_SIZE)) {
            // react-doctor-disable-next-line react-doctor/async-await-in-loop
            await withRetry(
                () =>
                    this.db.execute(
                        mode === 'none'
                            ? buildBaselinelessAggregateUpsertSql(period, chunk)
                            : buildAggregateUpsertSql(
                                  mode,
                                  period,
                                  prevPeriod,
                                  chunk
                              )
                    ),
                DB_TRANSIENT_RETRY
            );
            // react-doctor-disable-next-line react-doctor/async-await-in-loop
            await withRetry(
                () =>
                    this.db.execute(
                        buildAggregateDeleteSql(mode, period, prevPeriod, chunk)
                    ),
                DB_TRANSIENT_RETRY
            );
            // 옵션 집계는 비교 모드와 무관하다(변화 열 없음) — 같은 dirty 청크로 함께 다시 계산한다.
            // react-doctor-disable-next-line react-doctor/async-await-in-loop
            await withRetry(
                () =>
                    this.db.execute(
                        buildOptionAggregateUpsertSql(period, chunk)
                    ),
                DB_TRANSIENT_RETRY
            );
            // react-doctor-disable-next-line react-doctor/async-await-in-loop
            await withRetry(
                () =>
                    this.db.execute(
                        buildOptionAggregateDeleteSql(period, chunk)
                    ),
                DB_TRANSIENT_RETRY
            );
        }
    }

    /** 한 분기의 변화 열을 NULL로 되돌린다(baseline 규칙이 엄격해졌을 때 — `rebuild --reset`). 바뀐 행 수. */
    async resetAggregateChanges(period: string): Promise<number> {
        const result = await withRetry(
            () => this.db.execute(buildResetChangesSql(period)),
            DB_TRANSIENT_RETRY
        );
        return affectedRows(result);
    }

    /**
     * `filing_date >= sinceDate`인 원장 행의 규모 — 늦은 매핑 재수집(`investor-flows:reingest-13f`)의 계획용.
     */
    async countLedgerSince(
        sinceDate: string
    ): Promise<{ rows: number; processed: number; unprocessed: number }> {
        const [row] = (await withRetry(
            () =>
                this.db.execute(sql`
                    SELECT count(*)::int AS rows,
                           (count(*) FILTER (WHERE processed_at IS NOT NULL))::int AS processed,
                           (count(*) FILTER (WHERE processed_at IS NULL))::int AS unprocessed
                    FROM sec_13f_filings WHERE filing_date >= ${sinceDate}::date`),
            DB_TRANSIENT_RETRY
        )) as unknown as {
            rows: number;
            processed: number;
            unprocessed: number;
        }[];
        return {
            rows: row?.rows ?? 0,
            processed: row?.processed ?? 0,
            unprocessed: row?.unprocessed ?? 0,
        };
    }

    /**
     * `filing_date >= sinceDate`인 원장 행을 지운다 — 일일 커서(`max(filing_date)`)가 창 시작일로 되돌아가고 지워진 accession이
     * 처리 전이 되어 sec-13f가 새 유니버스로 다시 읽는다. 포지션·집계는 건드리지 않는다. 지운 행 수.
     */
    async deleteLedgerSince(sinceDate: string): Promise<number> {
        const result = await withRetry(
            () =>
                this.db.execute(
                    sql`DELETE FROM sec_13f_filings WHERE filing_date >= ${sinceDate}::date`
                ),
            DB_TRANSIENT_RETRY
        );
        return affectedRows(result);
    }

    /** 작은 key/value 상태(마지막 정리 하한 등). */
    async getState(key: string): Promise<string | null> {
        const [row] = await withRetry(
            () =>
                this.db
                    .select({ value: investorFlowsState.value })
                    .from(investorFlowsState)
                    .where(eq(investorFlowsState.key, key)),
            DB_TRANSIENT_RETRY
        );
        return row?.value ?? null;
    }

    async setState(key: string, value: string): Promise<void> {
        await withRetry(
            () =>
                this.db
                    .insert(investorFlowsState)
                    .values({ key, value })
                    .onConflictDoUpdate({
                        target: investorFlowsState.key,
                        set: { value, updatedAt: sql`now()` },
                    }),
            DB_TRANSIENT_RETRY
        );
    }

    /** 보존 하한보다 이른 분기의 포지션을 배치로 지운다(`prunePositionsBefore` 참고). */
    prunePositionsBefore(
        floor: string,
        shouldStop: () => boolean
    ): Promise<PruneResult> {
        return prunePositionsBefore(this.db, floor, shouldStop);
    }

    /** 오래된 분기 집계(주식·옵션)를 지운다. 지운 행 수의 합. */
    pruneAggregatesBefore(cutoffPeriod: string): Promise<number> {
        return pruneAggregatesBefore(this.db, cutoffPeriod);
    }

    /** 오래된 제출 원장 행을 지운다. */
    pruneFilingsBefore(cutoffDate: string): Promise<number> {
        return pruneFilingsBefore(this.db, cutoffDate);
    }
}
