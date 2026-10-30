import type { FailsToDeliverPoint } from '@y0ngha/siglens-core';
import { compareIsoDate } from '@/entities/investor-flows/lib/investorFlowsDates';
import { FTD_LOOKBACK_DAYS } from '@/entities/investor-flows/lib/snapshot/short';

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
