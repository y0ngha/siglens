import type {
    InstitutionalHolderChange,
    InstitutionalHolderChangeKind,
    InstitutionalOptionsQuarter,
    InstitutionalQuarter,
} from '@y0ngha/siglens-core';
import type { OptionAggregateRecord } from '../../model';
import { compareIsoDate, isPeriodComplete } from '../investorFlowsDates';
import { ascendingTail } from './snapshotRows';

/** 스냅샷에 담는 상한 — 화면·프롬프트 크기를 묶는다. */
export const SNAPSHOT_MAX_QUARTERS = 8;

/** 스냅샷 `topHolders`에 담는 보유 기관 수 상한. */
export const SNAPSHOT_MAX_TOP_HOLDERS = 25;
/** 스냅샷 `topHolders`에 청산 기관으로 덧붙이는 수 상한. */
export const SNAPSHOT_MAX_EXITED_HOLDERS = 5;

/** DB에서 읽은 분기 집계 한 행(변화 열은 이전 분기 기준이 없으면 null). */
export interface AggregateRecord {
    period: string;
    holders: number;
    shares: number;
    valueUsd: number;
    newHolders: number | null;
    increased: number | null;
    decreased: number | null;
    exited: number | null;
    netShareChange: number | null;
}

/** 최신 분기 보유 기관 한 행(이전 분기 수량 포함). `cur`이 없으면 청산(exited)이다. */
export interface HolderRecord {
    cik: string;
    filerName: string;
    shares: number;
    valueUsd: number;
    prevShares: number | null;
}

/** 이전 분기 기준(baseline)이 있어 변화 열이 모두 채워진 집계인가. */
function hasBaselineChanges(row: AggregateRecord): row is AggregateRecord & {
    newHolders: number;
    increased: number;
    decreased: number;
    exited: number;
    netShareChange: number;
} {
    return (
        row.newHolders !== null &&
        row.increased !== null &&
        row.decreased !== null &&
        row.exited !== null &&
        row.netShareChange !== null
    );
}

/**
 * 분기 집계 → core `InstitutionalQuarter`. **이전 분기 기준이 없는 분기(변화 열 NULL)는 통째로 뺀다** —
 * core 타입은 변화 필드를 숫자로 요구하고 `0`은 "변화 없음"으로 읽히므로, 비교 대상이 없다는 사실이
 * 중립 신호로 둔갑하면 안 된다(없음은 중립이 아니다). 그 분기의 보유 기관 수는 다음 분기의
 * `holders − newHolders + exited` 항등식으로 core가 복원한다.
 */
export function buildInstitutionalQuarters(
    aggregates: readonly AggregateRecord[],
    today: string
): InstitutionalQuarter[] {
    return aggregates
        .filter(hasBaselineChanges)
        .sort((a, b) => compareIsoDate(a.period, b.period))
        .slice(-SNAPSHOT_MAX_QUARTERS)
        .map(row => ({
            period: row.period,
            complete: isPeriodComplete(row.period, today),
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

function classify(
    shares: number,
    prevShares: number | null
): InstitutionalHolderChangeKind {
    if (shares === 0) return 'exited';
    if (prevShares === null) return 'new';
    if (shares > prevShares) return 'increased';
    if (shares < prevShares) return 'decreased';
    return 'unchanged';
}

/**
 * 최신 분기의 상위 보유 기관(수량 내림차순) + 청산한 상위 기관을 변화 종류와 함께 낸다.
 * `exitedHolders`는 이전 분기엔 있었고 이번 분기엔 보고하고도 보유하지 않은 기관이다.
 */
export function buildTopHolders(
    topHolders: readonly HolderRecord[],
    exitedHolders: readonly HolderRecord[]
): InstitutionalHolderChange[] {
    const held = topHolders
        .slice(0, SNAPSHOT_MAX_TOP_HOLDERS)
        .map<InstitutionalHolderChange>(row => ({
            filerName: row.filerName,
            cik: row.cik,
            shares: row.shares,
            valueUsd: row.valueUsd,
            prevShares: row.prevShares,
            change: classify(row.shares, row.prevShares),
        }));
    const exited = exitedHolders
        .slice(0, SNAPSHOT_MAX_EXITED_HOLDERS)
        .map<InstitutionalHolderChange>(row => ({
            filerName: row.filerName,
            cik: row.cik,
            shares: 0,
            valueUsd: 0,
            prevShares: row.prevShares,
            change: 'exited',
        }));
    return [...held, ...exited];
}

/** 분기별 13F 옵션 집계 → core 타입(오래된 분기 먼저). 진행 중 분기는 `complete: false`라 core가 채점하지 않는다. */
export function buildOptionQuarters(
    rows: readonly OptionAggregateRecord[],
    today: string
): InstitutionalOptionsQuarter[] {
    return ascendingTail(rows, row => row.period, SNAPSHOT_MAX_QUARTERS).map(
        row => ({
            period: row.period,
            complete: isPeriodComplete(row.period, today),
            putHolders: row.putHolders,
            putShares: row.putShares,
            putValueUsd: row.putValueUsd,
            callHolders: row.callHolders,
            callShares: row.callShares,
            callValueUsd: row.callValueUsd,
        })
    );
}
