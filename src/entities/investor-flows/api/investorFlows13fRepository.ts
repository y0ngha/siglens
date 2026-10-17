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
    type SQL,
} from 'drizzle-orm';
import { DB_TRANSIENT_RETRY } from '@/shared/db/isTransientDbError';
import {
    cusipSymbolMap,
    investorFlowsState,
    sec13fDirtyAggregates,
    sec13fFilers,
    sec13fFilings,
    sec13fOptionPositions,
    sec13fPositions,
} from '@/shared/db/schema';
import type { SiglensDatabase } from '@/shared/db/types';
import { withRetry } from '@/shared/lib/withRetry';
import {
    INVESTOR_FLOWS_PRUNE_BATCH_SIZE,
    INVESTOR_FLOWS_UPSERT_CHUNK_SIZE,
    INVESTOR_FLOWS_VALUE_K_MAX,
} from '../lib/investorFlowsPolicy';
import type { AmendmentFiling } from '../lib/amendmentPlan';
import { cikToInt, cikToString } from '../lib/cik';
import { compositeKey } from '../lib/dedupeByKey';
import { nextQuarterEnd, previousQuarterEnd } from '../lib/investorFlowsDates';
import type {
    AmendmentType,
    FilingRecord,
    OptionPositionRow,
    PositionApplyMode,
    PositionRow,
} from '../model';
import {
    buildAggregateDeleteSql,
    buildAggregateUpsertSql,
    buildBaselinelessAggregateUpsertSql,
    buildOptionAggregateDeleteSql,
    buildOptionAggregateUpsertSql,
    buildResetChangesSql,
    type AggregateMode,
} from './aggregateSql';
import { warnWithDetail } from '@/shared/lib/warnWithDetail';
import { type UpsertLog, uniqueForUpsert } from './uniqueForUpsert';

const FILING_LOOKUP_CHUNK = 1_000;

/** `applyFiling`이 한 제출을 반영할 때 필요한 값. */
export interface ApplyFilingInput {
    accession: string;
    cik: string;
    filingDate: string;
    submissionType: string;
    amendmentType: AmendmentType | null;
    /** `null`이면 포지션 없이 "처리됨"만 기록한다(보존 하한 이전 분기·통지 등). */
    period: string | null;
    filerName: string | null;
    mode: PositionApplyMode;
    rows: readonly PositionRow[];
    /**
     * 같은 information table의 옵션 행(풋·콜). 주식 포지션과 **같은 모드·같은 트랜잭션**으로 반영된다 — 교체는 그 (cik, period)의
     * 옵션 행도 지우고, 병합은 upsert, 건너뜀은 손대지 않는다.
     */
    optionRows: readonly OptionPositionRow[];
    /** 유니버스 CUSIP → map id. 포지션은 id로 저장한다. */
    cusipIds: ReadonlyMap<string, number>;
    /**
     * 이 제출을 걸러 낸 유니버스 스냅샷의 시각(DB 시계, `loadUniverse`가 돌려준 값). 원장 `universe_stamp`에 적혀 CUSIP별
     * baseline 판정의 기준이 된다(`aggregateSql.ts`).
     */
    universeStamp: string;
    /**
     * 이 필러가 이 분기에 **처음** 반영되는 제출이면 true — 직전 분기 보유 CUSIP을 이 분기 집계의 dirty로도
     * 표시한다(이번 분기에서 빠진 종목은 쓰인 행이 없어 `exited`가 갱신될 방법이 이것뿐이다).
     */
    firstForPeriod: boolean;
    /**
     * 이 제출(RESTATEMENT 교체)보다 **나중에** 낸 NEW HOLDINGS 정정들의 포지션 — 교체와 **같은 트랜잭션**에서
     * `merge`로 다시 얹는다. 호출부가 트랜잭션 **전에** 모두 내려받아 둔다(내려받다 실패하면 교체 자체를 하지 않는다 —
     * 교체만 커밋되고 재반영이 실패해 나중 정정이 영영 사라지는 일이 없다).
     */
    reapply?: readonly ReapplyAmendment[];
}

/** 교체 뒤에 다시 얹을 정정 하나(이미 반영된 제출이라 원장은 건드리지 않는다). */
export interface ReapplyAmendment {
    accession: string;
    rows: readonly PositionRow[];
    optionRows: readonly OptionPositionRow[];
}

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

function chunked<T>(items: readonly T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < items.length; i += size) {
        chunks.push(items.slice(i, i + size));
    }
    return chunks;
}

/** 천 달러(int4)로 — 반올림 + 클램프. */
export function toValueK(valueUsd: number): number {
    return Math.min(Math.round(valueUsd / 1_000), INVESTOR_FLOWS_VALUE_K_MAX);
}

/** drizzle `execute`(postgres-js)가 돌려주는 영향 행 수. */
function affectedRows(result: unknown): number {
    return (result as { count?: number }).count ?? 0;
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

    /**
     * 제출 하나를 반영한다(한 트랜잭션). 주식 포지션과 옵션 포지션(`sec_13f_option_positions`)에 같은 모드를 적용한다.
     *
     *  - `replace`: 그 (cik, period) 포지션을 **전부 지우고** 새로 넣는다(지워지는 CUSIP도 dirty).
     *  - `merge`: upsert — 값이 실제로 바뀐 행만 갱신하고 그 CUSIP만 dirty.
     *  - `skip`: 포지션은 건드리지 않는다(나중 RESTATEMENT가 이미 있다).
     *
     * dirty 큐(`sec_13f_dirty_aggregates`)는 같은 트랜잭션에서 쓴다 — 포지션이 커밋되면 재계산 의무도 커밋된다.
     * @returns 값이 바뀌어 쓴 CUSIP들.
     */
    async applyFiling(input: ApplyFilingInput): Promise<string[]> {
        return withRetry(
            () =>
                this.db.transaction(async tx => {
                    const written = new Set<string>();
                    const cik = cikToInt(input.cik);
                    const idToCusip = new Map(
                        [...input.cusipIds].map(([cusip, id]) => [id, cusip])
                    );
                    const markDirty = async (
                        period: string,
                        ids: readonly number[]
                    ): Promise<void> => {
                        for (const chunk of chunked(
                            ids,
                            INVESTOR_FLOWS_UPSERT_CHUNK_SIZE
                        )) {
                            // 한 트랜잭션 안이라 직렬이어야 한다.
                            // react-doctor-disable-next-line react-doctor/async-await-in-loop
                            await tx
                                .insert(sec13fDirtyAggregates)
                                .values(
                                    chunk.map(cusipId => ({ period, cusipId }))
                                )
                                .onConflictDoNothing();
                        }
                    };

                    if (input.period !== null && input.mode !== 'skip') {
                        const period = input.period;
                        if (input.mode === 'replace') {
                            // 지우기 전에 SQL 쪽에서 dirty로 옮긴다 — 메모리에 id를 올리지 않는다.
                            await tx.execute(sql`
                                INSERT INTO sec_13f_dirty_aggregates (period, cusip_id)
                                SELECT period, cusip_id FROM sec_13f_positions
                                WHERE cik = ${cik} AND period = ${period}::date
                                ON CONFLICT DO NOTHING`);
                            await tx
                                .delete(sec13fPositions)
                                .where(
                                    and(
                                        eq(sec13fPositions.cik, cik),
                                        eq(sec13fPositions.period, period)
                                    )
                                );
                            // 옵션 행도 같은 규칙: 지우기 전에 그 CUSIP들을 dirty로 옮긴다(옵션 행은 CUSIP 문자열이라 맵으로 id를 찾는다).
                            await tx.execute(sql`
                                INSERT INTO sec_13f_dirty_aggregates (period, cusip_id)
                                SELECT o.period, m.id FROM sec_13f_option_positions o
                                JOIN cusip_symbol_map m ON m.cusip = o.cusip
                                WHERE o.cik = ${cik} AND o.period = ${period}::date
                                ON CONFLICT DO NOTHING`);
                            await tx
                                .delete(sec13fOptionPositions)
                                .where(
                                    and(
                                        eq(sec13fOptionPositions.cik, cik),
                                        eq(sec13fOptionPositions.period, period)
                                    )
                                );
                        }
                        // 한 분기 포지션 행들을 청크로 upsert하고 값이 바뀐 CUSIP을 dirty로 표시한다(교체 본문과 재반영이 공유).
                        const upsertRows = async (
                            source: readonly PositionRow[]
                        ): Promise<void> => {
                            // 생산자(`PositionAccumulator`)가 CUSIP별로 합산해 넘기므로 중복은 없어야 한다 — 그래도 한 문장의 중복
                            // 키는 21000으로 트랜잭션 전체를 버리므로 저장소가 스스로 지킨다.
                            const rows = uniqueForUpsert(
                                'sec_13f_positions',
                                source.flatMap(row => {
                                    const cusipId = input.cusipIds.get(
                                        row.cusip
                                    );
                                    return cusipId === undefined
                                        ? []
                                        : [{ ...row, cusipId }];
                                }),
                                row => String(row.cusipId),
                                this.log
                            );
                            for (const chunk of chunked(
                                rows,
                                INVESTOR_FLOWS_UPSERT_CHUNK_SIZE
                            )) {
                                // react-doctor-disable-next-line react-doctor/async-await-in-loop
                                const changed = await tx
                                    .insert(sec13fPositions)
                                    .values(
                                        chunk.map(row => ({
                                            shares: row.shares,
                                            cik,
                                            cusipId: row.cusipId,
                                            period,
                                            valueK: toValueK(row.valueUsd),
                                        }))
                                    )
                                    .onConflictDoUpdate({
                                        target: [
                                            sec13fPositions.cik,
                                            sec13fPositions.period,
                                            sec13fPositions.cusipId,
                                        ],
                                        set: {
                                            shares: sql`excluded.shares`,
                                            valueK: sql`excluded.value_k`,
                                        },
                                        setWhere: sql`${sec13fPositions.shares} IS DISTINCT FROM excluded.shares OR ${sec13fPositions.valueK} IS DISTINCT FROM excluded.value_k`,
                                    })
                                    .returning({
                                        cusipId: sec13fPositions.cusipId,
                                    });
                                const ids = changed.map(row => row.cusipId);
                                // react-doctor-disable-next-line react-doctor/async-await-in-loop
                                await markDirty(period, ids);
                                for (const id of ids) {
                                    const cusip = idToCusip.get(id);
                                    if (cusip !== undefined) written.add(cusip);
                                }
                            }
                        };
                        // 옵션 행 upsert — 값이 바뀐 (CUSIP, 종류)의 CUSIP을 dirty로 표시한다(옵션 집계도 같은 큐로 재계산된다).
                        const upsertOptionRows = async (
                            source: readonly OptionPositionRow[]
                        ): Promise<void> => {
                            const rows = uniqueForUpsert(
                                'sec_13f_option_positions',
                                source.filter(row =>
                                    input.cusipIds.has(row.cusip)
                                ),
                                row => compositeKey(row.cusip, row.putCall),
                                this.log
                            );
                            for (const chunk of chunked(
                                rows,
                                INVESTOR_FLOWS_UPSERT_CHUNK_SIZE
                            )) {
                                // react-doctor-disable-next-line react-doctor/async-await-in-loop
                                const changed = await tx
                                    .insert(sec13fOptionPositions)
                                    .values(
                                        chunk.map(row => ({
                                            cik,
                                            cusip: row.cusip,
                                            period,
                                            putCall: row.putCall,
                                            shares: row.shares,
                                            valueUsd: row.valueUsd,
                                        }))
                                    )
                                    .onConflictDoUpdate({
                                        target: [
                                            sec13fOptionPositions.cik,
                                            sec13fOptionPositions.cusip,
                                            sec13fOptionPositions.period,
                                            sec13fOptionPositions.putCall,
                                        ],
                                        set: {
                                            shares: sql`excluded.shares`,
                                            valueUsd: sql`excluded.value_usd`,
                                        },
                                        setWhere: sql`${sec13fOptionPositions.shares} IS DISTINCT FROM excluded.shares OR ${sec13fOptionPositions.valueUsd} IS DISTINCT FROM excluded.value_usd`,
                                    })
                                    .returning({
                                        cusip: sec13fOptionPositions.cusip,
                                    });
                                const ids = [
                                    ...new Set(
                                        changed.flatMap(row => {
                                            const id = input.cusipIds.get(
                                                row.cusip
                                            );
                                            return id === undefined ? [] : [id];
                                        })
                                    ),
                                ];
                                // react-doctor-disable-next-line react-doctor/async-await-in-loop
                                await markDirty(period, ids);
                                for (const row of changed)
                                    written.add(row.cusip);
                            }
                        };
                        await upsertRows(input.rows);
                        await upsertOptionRows(input.optionRows);
                        // 교체가 지운 뒤 나중 NEW HOLDINGS를 같은 트랜잭션에서 다시 얹는다.
                        for (const amendment of input.reapply ?? []) {
                            // 순서가 의미를 가져 직렬이다(교체 → 오래된 정정부터).
                            // react-doctor-disable-next-line react-doctor/async-await-in-loop
                            await upsertRows(amendment.rows);
                            // react-doctor-disable-next-line react-doctor/async-await-in-loop
                            await upsertOptionRows(amendment.optionRows);
                        }
                        if (input.firstForPeriod) {
                            // 이번 분기에서 빠진 종목의 `exited`는 쓰인 행이 없어 갱신될 길이 이것뿐이다.
                            await tx.execute(sql`
                                INSERT INTO sec_13f_dirty_aggregates (period, cusip_id)
                                SELECT ${period}::date, cusip_id FROM sec_13f_positions
                                WHERE cik = ${cik} AND period = ${previousQuarterEnd(period)}::date
                                ON CONFLICT DO NOTHING`);
                            // 이 필러가 **다음 분기**에 이미 낸 적이 있다면, 이제 (이번·다음) 두 분기를 모두 낸 필러가 되어
                            // 다음 분기의 패널 구성이 바뀐다 — 다음 분기 집계에서 이 필러의 보유 CUSIP도 dirty.
                            await tx.execute(sql`
                                INSERT INTO sec_13f_dirty_aggregates (period, cusip_id)
                                SELECT ${nextQuarterEnd(period)}::date, cusip_id FROM sec_13f_positions
                                WHERE cik = ${cik} AND period = ${nextQuarterEnd(period)}::date
                                ON CONFLICT DO NOTHING`);
                        }
                    }

                    if (input.filerName !== null) {
                        await tx
                            .insert(sec13fFilers)
                            .values({ cik, name: input.filerName })
                            .onConflictDoUpdate({
                                target: sec13fFilers.cik,
                                set: {
                                    name: sql`excluded.name`,
                                    updatedAt: sql`now()`,
                                },
                                setWhere: sql`${sec13fFilers.name} IS DISTINCT FROM excluded.name`,
                            });
                    }

                    await tx
                        .insert(sec13fFilings)
                        .values({
                            accession: input.accession,
                            cik,
                            period: input.period,
                            filingDate: input.filingDate,
                            submissionType: input.submissionType,
                            amendmentType: input.amendmentType,
                            attempts: 0,
                            processedAt: sql`now()`,
                            universeStamp: sql`${input.universeStamp}::timestamptz`,
                        })
                        .onConflictDoUpdate({
                            target: sec13fFilings.accession,
                            set: {
                                period: sql`excluded.period`,
                                amendmentType: sql`excluded.amendment_type`,
                                lastError: sql`NULL`,
                                processedAt: sql`now()`,
                                universeStamp: sql`excluded.universe_stamp`,
                            },
                        });
                    return [...written];
                }),
            DB_TRANSIENT_RETRY
        );
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

    /**
     * 보존 하한보다 이른 분기의 포지션을 **배치로** 지운다(집계는 남는다) — 주식 포지션 다음 옵션 포지션(같은 보존 규칙).
     * `RETURNING`을 쓰지 않고 드라이버의 영향 행 수만 읽는다(수백만 행을 메모리에 올리지 않는다). 한 배치는
     * `INVESTOR_FLOWS_PRUNE_BATCH_SIZE`행을 ctid로 지운다 — `period < floor`는 BRIN 인덱스가 받친다. `shouldStop`이 true가 되면
     * 멈추고 `done=false`(두 테이블을 다 비워야 `done`).
     */
    async prunePositionsBefore(
        floor: string,
        shouldStop: () => boolean
    ): Promise<{ deleted: number; done: boolean }> {
        const stock = await this.pruneBatchesBefore(
            sql`sec_13f_positions`,
            floor,
            shouldStop
        );
        if (!stock.done) return stock;
        const options = await this.pruneBatchesBefore(
            sql`sec_13f_option_positions`,
            floor,
            shouldStop
        );
        return {
            deleted: stock.deleted + options.deleted,
            done: options.done,
        };
    }

    private async pruneBatchesBefore(
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
                    this.db.execute(sql`
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
    async pruneAggregatesBefore(cutoffPeriod: string): Promise<number> {
        const stock = affectedRows(
            await withRetry(
                () =>
                    this.db.execute(
                        sql`DELETE FROM sec_13f_aggregates WHERE period < ${cutoffPeriod}::date`
                    ),
                DB_TRANSIENT_RETRY
            )
        );
        const options = affectedRows(
            await withRetry(
                () =>
                    this.db.execute(
                        sql`DELETE FROM sec_13f_option_aggregates WHERE period < ${cutoffPeriod}::date`
                    ),
                DB_TRANSIENT_RETRY
            )
        );
        return stock + options;
    }

    /** 오래된 제출 원장 행을 지운다(멱등 판정에 더는 필요 없는 옛 제출일). */
    async pruneFilingsBefore(cutoffDate: string): Promise<number> {
        return affectedRows(
            await withRetry(
                () =>
                    this.db.execute(
                        sql`DELETE FROM sec_13f_filings WHERE filing_date < ${cutoffDate}::date`
                    ),
                DB_TRANSIENT_RETRY
            )
        );
    }
}
