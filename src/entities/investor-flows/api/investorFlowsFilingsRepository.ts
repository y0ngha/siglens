import 'server-only';
import { affectedRows } from './affectedRows';
import { and, desc, eq, gte, inArray, sql, type SQL } from 'drizzle-orm';
import { DB_TRANSIENT_RETRY } from '@/shared/db/isTransientDbError';
import {
    secCikSymbolMap,
    secFilingsFailures,
    secForm144,
    secOfferingFilings,
} from '@/shared/db/schema';
import type { SiglensDatabase } from '@/shared/db/types';
import { withRetry } from '@/shared/lib/withRetry';
import { INVESTOR_FLOWS_UPSERT_CHUNK_SIZE } from '../lib/investorFlowsPolicy';
import { cikToInt, cikToString } from '../lib/cik';
import type { CikSymbolPair } from '../lib/companyTickers';
import { isOfferingKind, secFilingIndexUrl } from '../lib/offeringIndex';
import type {
    FilingRetry,
    Form144Row,
    OfferingFilingRow,
    OfferingRecord,
    ProposedSaleRecord,
} from '../model';
import {
    readInvestorFlowsState,
    writeInvestorFlowsState,
} from './investorFlowsState';

const LOOKUP_CHUNK = 1_000;

function chunked<T>(items: readonly T[], size: number): T[][] {
    return Array.from({ length: Math.ceil(items.length / size) }, (_, i) =>
        items.slice(i * size, (i + 1) * size)
    );
}

/** 재시도 큐에 넣을 문서 하나(시도 횟수는 저장소가 센다). */
export type FilingFailureTarget = Omit<FilingRetry, 'attempts'>;

/** 보존 정리 기준일(이 날짜보다 이른 행을 지운다). */
export interface FilingsPruneCutoffs {
    form144Before: string;
    offeringsBefore: string;
    failuresBefore: string;
}

export interface FilingsPruneResult {
    form144: number;
    offerings: number;
    failures: number;
}

/** `sec_cik_symbol_map` 교체 결과. */
export interface CikMapReplaceResult {
    upserted: number;
    deleted: number;
}

/**
 * Form 144·증자 공시 저장소 + `sec_cik_symbol_map`(유니버스 CIK 사전 필터). 쓰기는 청크 upsert, 문서 실패는
 * `sec_filings_failures` 재시도 큐 — 저장에 성공한 accession의 실패 기록은 같은 트랜잭션에서 지운다.
 */
export class DrizzleSecFilingsRepository {
    constructor(private readonly db: SiglensDatabase) {}

    getState(key: string): Promise<string | null> {
        return readInvestorFlowsState(this.db, key);
    }

    setState(key: string, value: string): Promise<void> {
        return writeInvestorFlowsState(this.db, key, value);
    }

    /** SEC CIK → 유니버스 심볼들(정렬). Form 144·증자 공시 index 줄의 사전 필터다. */
    async loadCikSymbols(): Promise<Map<number, string[]>> {
        const rows = await withRetry(
            () =>
                this.db
                    .select({
                        cik: secCikSymbolMap.cik,
                        symbol: secCikSymbolMap.symbol,
                    })
                    .from(secCikSymbolMap)
                    .orderBy(secCikSymbolMap.cik, secCikSymbolMap.symbol),
            DB_TRANSIENT_RETRY
        );
        const map = new Map<number, string[]>();
        for (const row of rows) {
            map.set(row.cik, [...(map.get(row.cik) ?? []), row.symbol]);
        }
        return map;
    }

    /**
     * `sec_cik_symbol_map`을 `pairs`로 **교체**한다(한 트랜잭션). 모든 쌍을 `updated_at = now()`로 upsert한 뒤 그보다 오래된 행
     * (= 이번 목록에 없는 쌍: 상장 폐지·티커 변경)을 지운다 — 트랜잭션 안의 `now()`는 하나라 비교가 정확하다.
     * 빈 목록으로 맵을 비우지 않도록 하는 최소 규모 검사는 호출부(`syncCikSymbolMap`)가 한다.
     */
    async replaceCikSymbolMap(
        pairs: readonly CikSymbolPair[]
    ): Promise<CikMapReplaceResult> {
        return withRetry(
            () =>
                this.db.transaction(async tx => {
                    for (const chunk of chunked(
                        pairs,
                        INVESTOR_FLOWS_UPSERT_CHUNK_SIZE
                    )) {
                        // 한 트랜잭션 안이라 직렬이어야 한다.
                        // react-doctor-disable-next-line react-doctor/async-await-in-loop
                        await tx
                            .insert(secCikSymbolMap)
                            .values(chunk.map(pair => ({ ...pair })))
                            .onConflictDoUpdate({
                                target: [
                                    secCikSymbolMap.cik,
                                    secCikSymbolMap.symbol,
                                ],
                                set: { updatedAt: sql`now()` },
                            });
                    }
                    const deleted = await tx.execute(
                        sql`DELETE FROM sec_cik_symbol_map WHERE updated_at < now()`
                    );
                    return {
                        upserted: pairs.length,
                        deleted: affectedRows(deleted),
                    };
                }),
            DB_TRANSIENT_RETRY
        );
    }

    /** `accessions` 중 Form 144가 이미 저장된 것. */
    async findStoredForm144(
        accessions: readonly string[]
    ): Promise<Set<string>> {
        return this.findExisting(accessions, async chunk =>
            (
                await this.db
                    .select({ accession: secForm144.accession })
                    .from(secForm144)
                    .where(inArray(secForm144.accession, chunk))
            ).map(row => row.accession)
        );
    }

    /** `accessions` 중 증자 공시 행이 이미 저장된 것. */
    async findStoredOfferings(
        accessions: readonly string[]
    ): Promise<Set<string>> {
        return this.findExisting(accessions, async chunk =>
            (
                await this.db
                    .selectDistinct({
                        accession: secOfferingFilings.accession,
                    })
                    .from(secOfferingFilings)
                    .where(inArray(secOfferingFilings.accession, chunk))
            ).map(row => row.accession)
        );
    }

    /** `accessions` 중 재시도 큐에 있는 것의 시도 횟수(음성 표식은 소진된 횟수로 기록돼 있다). */
    async findFailureAttempts(
        accessions: readonly string[]
    ): Promise<Map<string, number>> {
        const found = new Map<string, number>();
        for (const chunk of chunked(accessions, LOOKUP_CHUNK)) {
            // 청크 직렬 실행은 의도다 — DB 커넥션 하나를 한꺼번에 두드리지 않는다.
            // react-doctor-disable-next-line react-doctor/async-await-in-loop
            const rows = await withRetry(
                () =>
                    this.db
                        .select({
                            accession: secFilingsFailures.accession,
                            attempts: secFilingsFailures.attempts,
                        })
                        .from(secFilingsFailures)
                        .where(inArray(secFilingsFailures.accession, chunk)),
                DB_TRANSIENT_RETRY
            );
            for (const row of rows) found.set(row.accession, row.attempts);
        }
        return found;
    }

    private async findExisting(
        accessions: readonly string[],
        query: (chunk: string[]) => Promise<string[]>
    ): Promise<Set<string>> {
        const found = new Set<string>();
        for (const chunk of chunked(accessions, LOOKUP_CHUNK)) {
            // react-doctor-disable-next-line react-doctor/async-await-in-loop
            const rows = await withRetry(
                () => query(chunk),
                DB_TRANSIENT_RETRY
            );
            for (const accession of rows) found.add(accession);
        }
        return found;
    }

    /** Form 144 행 upsert(+ 그 accession의 재시도 기록 삭제, 한 트랜잭션). 정정(144/A)은 같은 accession이 아니라 새 행이다. */
    async upsertForm144(rows: readonly Form144Row[]): Promise<void> {
        if (rows.length === 0) return;
        await withRetry(
            () =>
                this.db.transaction(async tx => {
                    for (const chunk of chunked(
                        rows,
                        INVESTOR_FLOWS_UPSERT_CHUNK_SIZE
                    )) {
                        // react-doctor-disable-next-line react-doctor/async-await-in-loop
                        await tx
                            .insert(secForm144)
                            .values(chunk.map(row => ({ ...row })))
                            .onConflictDoNothing({
                                target: secForm144.accession,
                            });
                        // react-doctor-disable-next-line react-doctor/async-await-in-loop
                        await tx.delete(secFilingsFailures).where(
                            inArray(
                                secFilingsFailures.accession,
                                chunk.map(row => row.accession)
                            )
                        );
                    }
                }),
            DB_TRANSIENT_RETRY
        );
    }

    /** 증자 공시 행 upsert(+ 그 accession의 재시도 기록 삭제, 한 트랜잭션). */
    async upsertOfferings(rows: readonly OfferingFilingRow[]): Promise<void> {
        if (rows.length === 0) return;
        await withRetry(
            () =>
                this.db.transaction(async tx => {
                    for (const chunk of chunked(
                        rows,
                        INVESTOR_FLOWS_UPSERT_CHUNK_SIZE
                    )) {
                        // react-doctor-disable-next-line react-doctor/async-await-in-loop
                        await tx
                            .insert(secOfferingFilings)
                            .values(chunk.map(row => ({ ...row })))
                            .onConflictDoUpdate({
                                target: [
                                    secOfferingFilings.accession,
                                    secOfferingFilings.symbol,
                                ],
                                set: { kind: sql`excluded.kind` },
                                setWhere: sql`${secOfferingFilings.kind} IS DISTINCT FROM excluded.kind`,
                            });
                        // react-doctor-disable-next-line react-doctor/async-await-in-loop
                        await tx
                            .delete(secFilingsFailures)
                            .where(
                                inArray(secFilingsFailures.accession, [
                                    ...new Set(chunk.map(row => row.accession)),
                                ])
                            );
                    }
                }),
            DB_TRANSIENT_RETRY
        );
    }

    /** 문서 실패를 기록하고 시도 횟수를 1 올린다(없으면 새로 만든다). */
    async recordFailure(
        target: FilingFailureTarget,
        error: string
    ): Promise<void> {
        await withRetry(
            () =>
                this.db
                    .insert(secFilingsFailures)
                    .values({
                        accession: target.accession,
                        cik: cikToInt(target.cik),
                        formType: target.formType,
                        filingDate: target.filingDate,
                        attempts: 1,
                        lastError: error,
                    })
                    .onConflictDoUpdate({
                        target: secFilingsFailures.accession,
                        set: {
                            attempts: sql`${secFilingsFailures.attempts} + 1`,
                            lastError: error,
                            updatedAt: sql`now()`,
                        },
                    }),
            DB_TRANSIENT_RETRY
        );
    }

    /**
     * 문서를 읽었지만 **일부러 저장하지 않은** accession(Form 144의 발행사가 유니버스 밖)을 내구성 있는 음성 표식으로 남긴다 —
     * `skipped = true`, 시도 횟수는 `maxAttempts`(소진)라 날짜 순회의 겹침 구간과 재시도 큐 어디서도 다시 받지 않는다.
     * 실패가 아니므로 backlog 경고(`countExhaustedFailures`)에는 세지 않는다. 같은 accession이 나중에 저장되면 지워진다.
     */
    async recordSkipped(
        target: FilingFailureTarget,
        reason: string,
        maxAttempts: number
    ): Promise<void> {
        await withRetry(
            () =>
                this.db
                    .insert(secFilingsFailures)
                    .values({
                        accession: target.accession,
                        cik: cikToInt(target.cik),
                        formType: target.formType,
                        filingDate: target.filingDate,
                        attempts: maxAttempts,
                        lastError: reason,
                        skipped: true,
                    })
                    .onConflictDoUpdate({
                        target: secFilingsFailures.accession,
                        set: {
                            attempts: maxAttempts,
                            lastError: reason,
                            skipped: true,
                            updatedAt: sql`now()`,
                        },
                    }),
            DB_TRANSIENT_RETRY
        );
    }

    /** 시도 횟수가 남은 실패 문서(오래된 제출 순). 음성 표식(`skipped`)은 시도를 소진한 상태라 여기 오지 않는다. */
    async listRetries(
        maxAttempts: number,
        limit: number
    ): Promise<FilingRetry[]> {
        const rows = await withRetry(
            () =>
                this.db
                    .select()
                    .from(secFilingsFailures)
                    .where(sql`${secFilingsFailures.attempts} < ${maxAttempts}`)
                    .orderBy(secFilingsFailures.filingDate)
                    .limit(limit),
            DB_TRANSIENT_RETRY
        );
        return rows.map(row => ({
            accession: row.accession,
            cik: cikToString(row.cik),
            formType: row.formType,
            filingDate: row.filingDate,
            attempts: row.attempts,
        }));
    }

    /** 보존 정리(행 수가 작아 배치 없이 한 문장씩). */
    async pruneBefore(
        cutoffs: FilingsPruneCutoffs
    ): Promise<FilingsPruneResult> {
        const run = async (statement: SQL): Promise<number> =>
            affectedRows(
                await withRetry(
                    () => this.db.execute(statement),
                    DB_TRANSIENT_RETRY
                )
            );
        return {
            form144: await run(
                sql`DELETE FROM sec_form144 WHERE filing_date < ${cutoffs.form144Before}::date`
            ),
            offerings: await run(
                sql`DELETE FROM sec_offering_filings WHERE filing_date < ${cutoffs.offeringsBefore}::date`
            ),
            failures: await run(
                sql`DELETE FROM sec_filings_failures WHERE filing_date < ${cutoffs.failuresBefore}::date`
            ),
        };
    }

    /**
     * 심볼 발행사의 Form 144(`sinceDate` 이후, 최신순 `limit`건). 행의 대표 심볼이 아니라 **발행사 CIK**로 찾는다 — 클래스가
     * 여럿인 발행사(`GOOG`·`GOOGL`)의 신고가 모든 클래스에서 보인다.
     */
    async findProposedSales(
        symbol: string,
        sinceDate: string,
        limit: number
    ): Promise<ProposedSaleRecord[]> {
        const rows = await withRetry(
            () =>
                this.db
                    .select()
                    .from(secForm144)
                    .where(
                        and(
                            gte(secForm144.filingDate, sinceDate),
                            sql`${secForm144.issuerCik} IN (SELECT cik FROM sec_cik_symbol_map WHERE symbol = ${symbol})`
                        )
                    )
                    .orderBy(desc(secForm144.filingDate), secForm144.accession)
                    .limit(limit),
            DB_TRANSIENT_RETRY
        );
        return rows.map(row => ({
            accession: row.accession,
            filingDate: row.filingDate,
            formType: row.formType,
            filer: row.filerName,
            filerCik: row.filerCik,
            relationships: row.relationships,
            shares: row.shares,
            valueUsd: row.valueUsd,
            approxSaleDate: row.approxSaleDate,
            planAdoptionDate: row.planAdoptionDate,
            url: secFilingIndexUrl(row.issuerCik, row.accession),
        }));
    }

    /** 심볼의 증자·희석 공시(`sinceDate` 이후, 최신순 `limit`건). */
    async findOfferings(
        symbol: string,
        sinceDate: string,
        limit: number
    ): Promise<OfferingRecord[]> {
        const rows = await withRetry(
            () =>
                this.db
                    .select({
                        accession: secOfferingFilings.accession,
                        filingDate: secOfferingFilings.filingDate,
                        formType: secOfferingFilings.formType,
                        kind: secOfferingFilings.kind,
                        url: secOfferingFilings.url,
                    })
                    .from(secOfferingFilings)
                    .where(
                        and(
                            eq(secOfferingFilings.symbol, symbol),
                            gte(secOfferingFilings.filingDate, sinceDate)
                        )
                    )
                    .orderBy(
                        desc(secOfferingFilings.filingDate),
                        secOfferingFilings.accession
                    )
                    .limit(limit),
            DB_TRANSIENT_RETRY
        );
        // `kind`는 `upsertOfferings`가 `OfferingKind` 값만 쓰지만 열은 varchar라 읽을 때 좁힌다(모르는 값은 `other`).
        return rows.map(row => ({
            ...row,
            kind: isOfferingKind(row.kind) ? row.kind : 'other',
        }));
    }

    /** 시도를 소진해 영구 실패로 남은 문서 수 — backlog 경고용(음성 표식 `skipped`는 실패가 아니라 빼고 센다). */
    async countExhaustedFailures(maxAttempts: number): Promise<number> {
        const [row] = await withRetry(
            () =>
                this.db
                    .select({ n: sql<number>`count(*)::int` })
                    .from(secFilingsFailures)
                    .where(
                        and(
                            gte(secFilingsFailures.attempts, maxAttempts),
                            eq(secFilingsFailures.skipped, false)
                        )
                    ),
            DB_TRANSIENT_RETRY
        );
        return row?.n ?? 0;
    }
}
