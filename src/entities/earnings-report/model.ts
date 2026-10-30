import type { EarningsCalendarItem } from '@y0ngha/siglens-core';

/** 프로바이더 응답을 `earnings_reports` 행으로 upsert할 때 받는 입력. 원본 응답은 `rawPayload`로 보존한다. */
export interface EarningsReportUpsertInput {
    symbol: string;
    earningsDate: string;
    epsActual: number | null;
    epsEstimated: number | null;
    revenueActual: number | null;
    revenueEstimated: number | null;
    lastUpdated: string | null;
    rawPayload: unknown;
}

/**
 * 다음 실적 일정 + 그 날짜가 확정 공시인지.
 *
 * `dateConfirmed`는 프로바이더가 확정 여부를 알려 줄 때만 boolean이다 — yahoo(KR)는
 * `calendarEvents.earnings.isEarningsDateEstimate`를 `rawPayload.isEstimate`로 남기고,
 * FMP `/stable/earnings`는 확정 플래그도 발표 시각(장전·장후)도 주지 않아 `null`이다.
 * core의 `EarningsCalendarItem`을 넓히지 않고 siglens 쪽에서만 붙인다 — 분석 경로
 * (`getNextEarningsReport`)가 core에 넘기는 모양은 그대로 둔다.
 */
export interface NextEarningsSchedule extends EarningsCalendarItem {
    dateConfirmed: boolean | null;
}

/** DB에서 읽은 실적 행(numeric 컬럼은 문자열). 비교 카드 슬롯 배정 입력이다. */
export interface EarningsReportDataRow {
    symbol: string;
    earningsDate: string;
    epsActual: string | null;
    epsEstimated: string | null;
    revenueActual: string | null;
    revenueEstimated: string | null;
    lastUpdated: string | null;
}
