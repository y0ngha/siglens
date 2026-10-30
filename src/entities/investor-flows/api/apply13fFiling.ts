import 'server-only';
import { and, eq, sql } from 'drizzle-orm';
import { DB_TRANSIENT_RETRY } from '@/shared/db/isTransientDbError';
import {
    sec13fDirtyAggregates,
    sec13fFilers,
    sec13fFilings,
    sec13fOptionPositions,
    sec13fPositions,
} from '@/shared/db/schema';
import type { SiglensDatabase } from '@/shared/db/types';
import { withRetry } from '@/shared/lib/withRetry';
import { chunked } from '../lib/chunked';
import { cikToInt } from '../lib/cik';
import { compositeKey } from '../lib/dedupeByKey';
import {
    INVESTOR_FLOWS_UPSERT_CHUNK_SIZE,
    INVESTOR_FLOWS_VALUE_K_MAX,
} from '../lib/investorFlowsPolicy';
import { nextQuarterEnd, previousQuarterEnd } from '../lib/investorFlowsDates';
import type {
    AmendmentType,
    OptionPositionRow,
    PositionApplyMode,
    PositionRow,
} from '../model';
import { type UpsertLog, uniqueForUpsert } from './uniqueForUpsert';

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

/** 천 달러(int4)로 — 반올림 + 클램프. */
export function toValueK(valueUsd: number): number {
    return Math.min(Math.round(valueUsd / 1_000), INVESTOR_FLOWS_VALUE_K_MAX);
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
export async function applyFiling(
    db: SiglensDatabase,
    log: UpsertLog,
    input: ApplyFilingInput
): Promise<string[]> {
    return withRetry(
        () =>
            db.transaction(async tx => {
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
                            .values(chunk.map(cusipId => ({ period, cusipId })))
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
                                const cusipId = input.cusipIds.get(row.cusip);
                                return cusipId === undefined
                                    ? []
                                    : [{ ...row, cusipId }];
                            }),
                            row => String(row.cusipId),
                            log
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
                            source.filter(row => input.cusipIds.has(row.cusip)),
                            row => compositeKey(row.cusip, row.putCall),
                            log
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
                            for (const row of changed) written.add(row.cusip);
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
