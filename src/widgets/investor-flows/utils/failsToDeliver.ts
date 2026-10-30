/**
 * SEC 결제 불이행(FTD) 막대 그래프 데이터와 발행주식 대비 %의 표시 자리.
 */
import type { FailsToDeliverPoint } from '@y0ngha/siglens-core';
import { compareIsoDate } from '@/entities/investor-flows/lib/investorFlowsDates';
import { FTD_LOOKBACK_DAYS } from '@/entities/investor-flows/lib/snapshot/short';

/** 발행주식 대비 %가 이 값(1%의 1/100) 미만이면 자리를 늘려 보인다. */
const SMALL_PCT_THRESHOLD = 0.01;
/** 발행주식 대비 %의 기본 소수 자리. */
const PCT_DIGITS = 2;
/** 아주 작은 발행주식 대비 %의 소수 자리 — core 비율 정밀도와 같다. */
const SMALL_PCT_DIGITS = 4;

/** 결제 불이행 막대 그래프 데이터. */
export interface FailsToDeliverSeries {
    /** 결제일 오름차순(실패가 있던 날만). */
    rows: FailsToDeliverPoint[];
    latest: FailsToDeliverPoint | null;
    /** 그려진 구간의 최대 수량(막대 높이 기준). 행이 없으면 0. */
    maxQty: number;
    /** 스냅샷이 FTD를 읽는 창(일) — "최근 N일 동안 기록 없음" 문구에 쓴다. */
    windowDays: number;
}

/** 결제 불이행 막대 그래프 데이터. 행이 없는 결제일은 실패가 없던 날이다(데이터 없음이 아니다). */
export function buildFailsToDeliverSeries(
    points: readonly FailsToDeliverPoint[]
): FailsToDeliverSeries {
    const rows = points.toSorted((a, b) =>
        compareIsoDate(a.settlementDate, b.settlementDate)
    );
    return {
        rows,
        latest: rows.at(-1) ?? null,
        maxQty: rows.reduce((max, row) => Math.max(max, row.failsQty), 0),
        windowDays: FTD_LOOKBACK_DAYS,
    };
}

/**
 * 발행주식 대비 %의 표시 자리 — 대형주 FTD는 0.0006%처럼 작아 두 자리로 줄이면 "0.00%"가 된다. 0이 아니면서 1%의 1/100
 * 미만이면 네 자리(core 비율 정밀도)로 보인다. 결제 불이행 블록과 점수 카드 근거 줄이 같은 규칙을 쓴다.
 */
export function ftdPctDigits(value: number): number {
    return Math.abs(value) < SMALL_PCT_THRESHOLD && value !== 0
        ? SMALL_PCT_DIGITS
        : PCT_DIGITS;
}
