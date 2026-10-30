import type {
    FailsToDeliverPoint,
    ShortInterestPoint,
    ShortVolumePoint,
    ThresholdListStatus,
} from '@y0ngha/siglens-core';
import type { FtdPointRecord, ThresholdStatusSummary } from '../../model';
import { ascendingTail } from './snapshotRows';

/** 스냅샷에 담는 공매도 잔고 결제일 수 상한(최신순). */
export const SNAPSHOT_MAX_SHORT_INTEREST_POINTS = 12;
/** 스냅샷에 담는 일별 공매도 거래량 일수 상한(최신순). */
export const SNAPSHOT_MAX_SHORT_VOLUME_POINTS = 120;

/**
 * FTD를 읽는 창(일). core는 최근 30일(`FTD_RECENT_WINDOW_DAYS`)과 그 앞 60일 기준선(`FTD_BASELINE_WINDOW_DAYS`)을 보므로
 * 90일이면 판정에 충분하고, 화면 막대 그래프도 같은 창을 쓴다. 여유 30일은 SEC 게시 지연(약 2주)과 반월 경계 몫이다.
 */
export const FTD_LOOKBACK_DAYS = 120;

/** FTD 행은 실패가 있던 결제일에만 있다 — 120일 창의 거래일 수(약 84)를 넘지 않는다. */
export const SNAPSHOT_MAX_FTD_POINTS = 90;

/** DB에서 읽은 FINRA 공매도 잔고 한 행(결제일 기준). `buildShortInterest`가 core 포인트로 옮긴다. */
export interface ShortInterestRecord {
    settlementDate: string;
    shortQty: number;
    avgDailyVolume: number | null;
    daysToCover: number | null;
}

/** DB에서 읽은 FINRA 일별 공매도 거래량 한 행. `buildShortVolume`이 core 포인트로 옮긴다. */
export interface ShortVolumeRecord {
    tradeDate: string;
    shortVolume: number;
    totalVolume: number;
}

/** 공매도 잔고 행 → 최신 `SNAPSHOT_MAX_SHORT_INTEREST_POINTS`개를 오래된 순으로 담은 core 포인트. */
export function buildShortInterest(
    rows: readonly ShortInterestRecord[]
): ShortInterestPoint[] {
    return ascendingTail(
        rows,
        row => row.settlementDate,
        SNAPSHOT_MAX_SHORT_INTEREST_POINTS
    ).map(row => ({
        settlementDate: row.settlementDate,
        shortQty: row.shortQty,
        avgDailyVolume: row.avgDailyVolume,
        daysToCover: row.daysToCover,
    }));
}

/** 일별 공매도 거래량 행 → 최신 `SNAPSHOT_MAX_SHORT_VOLUME_POINTS`개를 오래된 순으로 담은 core 포인트. */
export function buildShortVolume(
    rows: readonly ShortVolumeRecord[]
): ShortVolumePoint[] {
    return ascendingTail(
        rows,
        row => row.tradeDate,
        SNAPSHOT_MAX_SHORT_VOLUME_POINTS
    ).map(row => ({
        date: row.tradeDate,
        shortVolume: row.shortVolume,
        totalVolume: row.totalVolume,
    }));
}

/** FTD 행 → 최신 `SNAPSHOT_MAX_FTD_POINTS`개를 오래된 순으로 담은 core 포인트. */
export function buildFailsToDeliver(
    rows: readonly FtdPointRecord[]
): FailsToDeliverPoint[] {
    return ascendingTail(
        rows,
        row => row.settlementDate,
        SNAPSHOT_MAX_FTD_POINTS
    ).map(row => ({
        settlementDate: row.settlementDate,
        failsQty: row.failsQty,
        price: row.price,
    }));
}

/**
 * 과열 목록 요약 → core 타입. 수집된 거래일이 하나도 없으면(`asOf: null`) "미등재"가 아니라 "모름"이라 `null`이다 —
 * core는 `null`을 꺼진 피드처럼 다룬다. `asOf`(목록 날짜)를 함께 넘겨 core가 낡은 상태(7일 초과)를 스스로 버리게 한다.
 */
export function buildThresholdList(
    summary: ThresholdStatusSummary
): ThresholdListStatus | null {
    if (summary.asOf === null) return null;
    return {
        listed: summary.listed,
        consecutiveDays: summary.consecutiveDays,
        firstListedDate: summary.firstListedDate,
        markets: summary.markets,
        asOf: summary.asOf,
    };
}
