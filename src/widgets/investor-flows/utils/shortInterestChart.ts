/**
 * 공매도 잔고 추이 그래프 두 개(잔고 또는 유통주식 대비 %, 상환일수)의 값·눈금·양끝 날짜.
 */
import { formatMonthDay } from './flowFormat';
import type { ShortInterestRow } from './short';

/** 그래프 한 줄의 값과 눈금 범위. 값이 `null`인 점은 선을 끊는다. */
export interface TrendSeries {
    values: (number | null)[];
    max: number;
    min: number;
}

/** 잔고 그래프가 그리는 단위 — 유통주식 수를 알면 %, 모르면 주식 수. */
export type ShortInterestBasis = 'pctFloat' | 'qty';

/** 공매도 잔고 추이 그래프 모델. */
export interface ShortInterestChartModel {
    basis: ShortInterestBasis;
    interest: TrendSeries;
    /** 상환일수 값이 하나도 없으면 `null`. */
    daysToCover: TrendSeries | null;
    /** 가로축 양끝 라벨 — 두 그래프가 같은 형식(`MM-DD`)을 쓴다. */
    startLabel: string;
    endLabel: string;
}

/** 값 배열에서 유한한 값만 모아 눈금 범위를 만든다. 유한한 값이 없으면 `null`. */
function toTrendSeries(values: (number | null)[]): TrendSeries | null {
    const finite = values.filter((value): value is number => value !== null);
    if (finite.length === 0) return null;
    return { values, max: Math.max(...finite), min: Math.min(...finite) };
}

/**
 * 결제일 오름차순 행에서 추이 그래프 데이터를 만든다. 행이 하나뿐이거나 그릴 값이 없으면 `null`(그래프를 그리지 않는다).
 * 최신 행에 유통주식 대비 %가 있으면 %로, 없으면 주식 수로 그린다 — 단위가 점마다 섞이지 않게 한 단위로 통일한다.
 */
export function buildShortInterestChartModel(
    rows: readonly ShortInterestRow[]
): ShortInterestChartModel | null {
    const latest = rows.at(-1);
    if (latest === undefined || rows.length < 2) return null;
    const basis: ShortInterestBasis =
        latest.pctOfFloat === null ? 'qty' : 'pctFloat';
    const interest = toTrendSeries(
        rows.map(row => (basis === 'pctFloat' ? row.pctOfFloat : row.shortQty))
    );
    if (interest === null) return null;
    return {
        basis,
        interest,
        daysToCover: toTrendSeries(rows.map(row => row.daysToCover)),
        startLabel: formatMonthDay(rows[0].settlementDate),
        endLabel: formatMonthDay(latest.settlementDate),
    };
}
