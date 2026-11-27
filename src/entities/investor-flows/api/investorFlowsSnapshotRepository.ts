import 'server-only';
import { and, asc, desc, eq, gt, inArray, isNotNull, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { DB_TRANSIENT_RETRY } from '@/shared/db/isTransientDbError';
import {
    cusipSymbolMap,
    sec13fAggregates,
    sec13fFilers,
    sec13fOptionAggregates,
    sec13fFilings,
    sec13fPositions,
} from '@/shared/db/schema';
import type { SiglensDatabase } from '@/shared/db/types';
import { withRetry } from '@/shared/lib/withRetry';
import type {
    AggregateRecord,
    HolderRecord,
} from '../lib/snapshot/institutional';
import type { OptionAggregateRecord } from '../model';
import { cikToString } from '../lib/cik';
import { previousQuarterEnd } from '../lib/investorFlowsDates';

/** CUSIP 문자열 → map id 서브쿼리(포지션은 id로 저장된다). */
const cusipIdOf = (cusip: string) =>
    sql`(SELECT id FROM cusip_symbol_map WHERE cusip = ${cusip})`;

/** LIKE 패턴의 와일드카드(`%`·`_`)와 이스케이프 문자(백슬래시)를 글자 그대로 취급하게 한다(Postgres 기본 이스케이프는 백슬래시). */
const escapeLike = (token: string): string =>
    token.replace(/[\\%_]/g, char => `\\${char}`);

/** `filerNameTokens`가 `&` 대신 내는 토큰 — 원본 이름에는 없으므로 SQL 필터에서 뺀다. */
const AMPERSAND_TOKEN = 'AND';

/** 이름으로 찾은 13F 제출자 한 곳. */
export interface FilerNameRow {
    cik: number;
    name: string;
}

/** 이름이 같은 제출자 한 곳의 한 분기 포지션(이전 분기 수량 포함). */
export interface HolderPositionRow {
    cik: number;
    filerName: string;
    shares: number;
    valueUsd: number;
    prevShares: number | null;
}

/** 제출자의 한 분기 13F 제출 한 건(원본과 정정이 함께 있을 수 있다). */
export interface FilerFilingRow {
    cik: number;
    /** `processed_at`이 있다 = 포지션이 반영됐다. */
    processed: boolean;
    /**
     * 이 제출이 그 CUSIP을 담을 수 있었나: 제출을 파싱한 시점의 유니버스(`universe_stamp`)가 CUSIP 매핑(`created_at`)
     * 이후다. `false`면 그 종목 행이 파싱 때 걸러졌을 수 있어 "행 없음"이 "보유 안 함"을 뜻하지 않는다.
     */
    couldListCusip: boolean;
}

/** 스냅샷 조립용 읽기 쿼리. 모두 (cusip_id, period) 또는 symbol 인덱스를 탄다. */
export class DrizzleInvestorFlowsSnapshotRepository {
    constructor(private readonly db: SiglensDatabase) {}

    /** 심볼에 매핑된 CUSIP들(가장 최근에 처음 매핑된 것이 먼저). 액면병합 등으로 둘 이상일 수 있다. */
    async findCusipsBySymbol(symbol: string): Promise<string[]> {
        const rows = await withRetry(
            () =>
                this.db
                    .select({ cusip: cusipSymbolMap.cusip })
                    .from(cusipSymbolMap)
                    .where(eq(cusipSymbolMap.symbol, symbol))
                    .orderBy(desc(cusipSymbolMap.createdAt)),
            DB_TRANSIENT_RETRY
        );
        return rows.map(row => row.cusip);
    }

    async findAggregates(
        cusip: string,
        limit: number
    ): Promise<AggregateRecord[]> {
        const rows = await withRetry(
            () =>
                this.db
                    .select()
                    .from(sec13fAggregates)
                    .where(eq(sec13fAggregates.cusip, cusip))
                    .orderBy(desc(sec13fAggregates.period))
                    .limit(limit),
            DB_TRANSIENT_RETRY
        );
        return rows.map(row => ({
            period: row.period,
            holders: row.holders,
            shares: row.shares,
            valueUsd: row.valueUsd,
            newHolders: row.newHolders,
            increased: row.increased,
            decreased: row.decreased,
            exited: row.exited,
            netShareChange: row.netShareChange,
        }));
    }

    /**
     * 분기별 13F 옵션(풋·콜) 집계, 최신 분기부터 `limit`개. 주식 집계(`findAggregates`)와 같은 CUSIP·같은 재계산 주기다.
     * `*Shares`는 기초자산 주식 수, `*ValueUsd`는 기초자산 명목금액(프리미엄이 아니다).
     */
    async findOptionAggregates(
        cusip: string,
        limit: number
    ): Promise<OptionAggregateRecord[]> {
        return withRetry(
            () =>
                this.db
                    .select({
                        period: sec13fOptionAggregates.period,
                        putHolders: sec13fOptionAggregates.putHolders,
                        putShares: sec13fOptionAggregates.putShares,
                        putValueUsd: sec13fOptionAggregates.putValueUsd,
                        callHolders: sec13fOptionAggregates.callHolders,
                        callShares: sec13fOptionAggregates.callShares,
                        callValueUsd: sec13fOptionAggregates.callValueUsd,
                    })
                    .from(sec13fOptionAggregates)
                    .where(eq(sec13fOptionAggregates.cusip, cusip))
                    .orderBy(desc(sec13fOptionAggregates.period))
                    .limit(limit),
            DB_TRANSIENT_RETRY
        );
    }

    /** 이 종목 포지션이 남아 있는 가장 최근 분기. */
    async findLatestPositionPeriod(cusip: string): Promise<string | null> {
        const [row] = await withRetry(
            () =>
                this.db
                    .select({ period: sec13fPositions.period })
                    .from(sec13fPositions)
                    .where(eq(sec13fPositions.cusipId, cusipIdOf(cusip)))
                    .orderBy(desc(sec13fPositions.period))
                    .limit(1),
            DB_TRANSIENT_RETRY
        );
        return row?.period ?? null;
    }

    /** `period`의 보유 수량 상위 기관(이전 분기 수량 포함). 가치는 천 달러 저장이라 ×1000으로 되돌린다. */
    async findTopHolders(
        cusip: string,
        period: string,
        limit: number
    ): Promise<HolderRecord[]> {
        const prev = alias(sec13fPositions, 'prev');
        const rows = await withRetry(
            () =>
                this.db
                    .select({
                        cik: sec13fPositions.cik,
                        filerName: sec13fFilers.name,
                        shares: sec13fPositions.shares,
                        valueK: sec13fPositions.valueK,
                        prevShares: prev.shares,
                    })
                    .from(sec13fPositions)
                    .leftJoin(
                        sec13fFilers,
                        eq(sec13fFilers.cik, sec13fPositions.cik)
                    )
                    .leftJoin(
                        prev,
                        and(
                            eq(prev.cik, sec13fPositions.cik),
                            eq(prev.cusipId, sec13fPositions.cusipId),
                            eq(prev.period, previousQuarterEnd(period))
                        )
                    )
                    .where(
                        and(
                            eq(sec13fPositions.cusipId, cusipIdOf(cusip)),
                            eq(sec13fPositions.period, period)
                        )
                    )
                    .orderBy(desc(sec13fPositions.shares))
                    .limit(limit),
            DB_TRANSIENT_RETRY
        );
        return rows.map(row => ({
            cik: cikToString(row.cik),
            filerName: row.filerName ?? cikToString(row.cik),
            shares: row.shares,
            valueUsd: row.valueK * 1_000,
            prevShares: row.prevShares,
        }));
    }

    /**
     * 이전 분기엔 보유했고 이번 분기엔 보유하지 않는 상위 기관. 집계의 `exited`와 같은 정의다:
     * **완결 분기**는 직전 분기 전체 대비(`requireFiled=false` — 더는 안 낸 필러도 청산), **진행 중 분기**는
     * 이번 분기에 이미 제출한 필러만(`requireFiled=true` — 아직 안 낸 기관은 청산이 아니다).
     */
    async findExitedHolders(
        cusip: string,
        period: string,
        limit: number,
        requireFiled: boolean
    ): Promise<HolderRecord[]> {
        const prevPeriod = previousQuarterEnd(period);
        const filedThisPeriod = () =>
            this.db
                .select({ cik: sec13fFilings.cik })
                .from(sec13fFilings)
                .where(
                    and(
                        eq(sec13fFilings.period, period),
                        isNotNull(sec13fFilings.processedAt)
                    )
                );
        const rows = await withRetry(
            () =>
                this.db
                    .select({
                        cik: sec13fPositions.cik,
                        filerName: sec13fFilers.name,
                        prevShares: sec13fPositions.shares,
                    })
                    .from(sec13fPositions)
                    .leftJoin(
                        sec13fFilers,
                        eq(sec13fFilers.cik, sec13fPositions.cik)
                    )
                    .where(
                        and(
                            eq(sec13fPositions.cusipId, cusipIdOf(cusip)),
                            eq(sec13fPositions.period, prevPeriod),
                            requireFiled
                                ? inArray(
                                      sec13fPositions.cik,
                                      filedThisPeriod()
                                  )
                                : undefined,
                            sql`NOT EXISTS (
                                SELECT 1 FROM sec_13f_positions c
                                WHERE c.cik = ${sec13fPositions.cik}
                                  AND c.cusip_id = ${sec13fPositions.cusipId}
                                  AND c.period = ${period}
                            )`
                        )
                    )
                    .orderBy(desc(sec13fPositions.shares))
                    .limit(limit),
            DB_TRANSIENT_RETRY
        );
        return rows.map(row => ({
            cik: cikToString(row.cik),
            filerName: row.filerName ?? cikToString(row.cik),
            shares: 0,
            valueUsd: 0,
            prevShares: row.prevShares,
        }));
    }

    /**
     * 이름에 모든 토큰이 들어 있는 13F 제출자(`upper(name) LIKE '%TOKEN%'`을 토큰마다 AND). 후보만 좁히는 1차 필터라
     * 정확한 판정은 호출자가 `matchesFiler`로 한다. 짧은 이름이 먼저 오게 정렬해 상한 안에 가장 가까운 이름이 들어간다.
     *
     * `AND` 토큰은 SQL 필터에서 뺀다: `filerNameTokens`는 `&`를 `AND`로 바꾸지만 DB의 원본 이름은 "DODGE & COX"라
     * `LIKE '%AND%'`가 맞지 않아 `&`가 들어간 제출자가 전부 사라진다. 두 쪽을 모두 정규화하는 `matchesFiler`가 `AND`를 본다.
     */
    async findFilersByNameTokens(
        tokens: readonly string[],
        limit: number
    ): Promise<FilerNameRow[]> {
        const likeTokens = tokens.filter(token => token !== AMPERSAND_TOKEN);
        if (likeTokens.length === 0) return [];
        return withRetry(
            () =>
                this.db
                    .select({ cik: sec13fFilers.cik, name: sec13fFilers.name })
                    .from(sec13fFilers)
                    .where(
                        and(
                            ...likeTokens.map(
                                token =>
                                    sql`upper(${sec13fFilers.name}) LIKE ${`%${escapeLike(token)}%`}`
                            )
                        )
                    )
                    .orderBy(
                        asc(sql`length(${sec13fFilers.name})`),
                        asc(sec13fFilers.name)
                    )
                    .limit(limit),
            DB_TRANSIENT_RETRY
        );
    }

    /** `ciks` 제출자들의 `period` 포지션(이전 분기 수량 포함, `findTopHolders`와 같은 조인), 수량 큰 순. 가치는 ×1000으로 되돌린다. */
    async findHolderPositions(
        cusip: string,
        period: string,
        ciks: readonly number[]
    ): Promise<HolderPositionRow[]> {
        if (ciks.length === 0) return [];
        const prev = alias(sec13fPositions, 'prev');
        const rows = await withRetry(
            () =>
                this.db
                    .select({
                        cik: sec13fPositions.cik,
                        filerName: sec13fFilers.name,
                        shares: sec13fPositions.shares,
                        valueK: sec13fPositions.valueK,
                        prevShares: prev.shares,
                    })
                    .from(sec13fPositions)
                    .leftJoin(
                        sec13fFilers,
                        eq(sec13fFilers.cik, sec13fPositions.cik)
                    )
                    .leftJoin(
                        prev,
                        and(
                            eq(prev.cik, sec13fPositions.cik),
                            eq(prev.cusipId, sec13fPositions.cusipId),
                            eq(prev.period, previousQuarterEnd(period))
                        )
                    )
                    .where(
                        and(
                            eq(sec13fPositions.cusipId, cusipIdOf(cusip)),
                            eq(sec13fPositions.period, period),
                            inArray(sec13fPositions.cik, [...ciks])
                        )
                    )
                    .orderBy(desc(sec13fPositions.shares)),
            DB_TRANSIENT_RETRY
        );
        return rows.map(row => ({
            cik: row.cik,
            filerName: row.filerName ?? cikToString(row.cik),
            shares: row.shares,
            valueUsd: row.valueK * 1_000,
            prevShares: row.prevShares,
        }));
    }

    /** `ciks` 제출자들이 `period`로 낸 13F 제출들과, 그 제출이 `cusip`을 담을 수 있었는지(`FilerFilingRow.couldListCusip`). */
    async findFilerFilings(
        cusip: string,
        ciks: readonly number[],
        period: string
    ): Promise<FilerFilingRow[]> {
        if (ciks.length === 0) return [];
        const rows = await withRetry(
            () =>
                this.db
                    .select({
                        cik: sec13fFilings.cik,
                        processed: sql<boolean>`${sec13fFilings.processedAt} IS NOT NULL`,
                        couldListCusip: sql<boolean>`COALESCE(${sec13fFilings.universeStamp} >= (SELECT created_at FROM cusip_symbol_map WHERE cusip = ${cusip}), false)`,
                    })
                    .from(sec13fFilings)
                    .where(
                        and(
                            inArray(sec13fFilings.cik, [...ciks]),
                            eq(sec13fFilings.period, period)
                        )
                    ),
            DB_TRANSIENT_RETRY
        );
        return rows;
    }

    /** `period`에서 `shares`보다 많이 가진 기관 수 — 순위(1 = 최대)는 이 값 + 1이다. (cusip_id, period) 인덱스를 탄다. */
    async countHoldersAbove(
        cusip: string,
        period: string,
        shares: number
    ): Promise<number> {
        const [row] = await withRetry(
            () =>
                this.db
                    .select({ count: sql<number>`count(*)::int` })
                    .from(sec13fPositions)
                    .where(
                        and(
                            eq(sec13fPositions.cusipId, cusipIdOf(cusip)),
                            eq(sec13fPositions.period, period),
                            gt(sec13fPositions.shares, shares)
                        )
                    ),
            DB_TRANSIENT_RETRY
        );
        return row?.count ?? 0;
    }
}
