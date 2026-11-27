import { minusCalendarMonths } from '@y0ngha/siglens-core';
import { addUtcIsoDays } from '@/shared/lib/isoDate';
import type { YahooDailyClose } from '@/shared/api/yahoo/yahooMacroSource';
import { pctVs } from './percent';

/** 일봉 기준 변화율 한 칸. `baseDate`는 기준이 된 거래일이다. */
export interface MacroChange {
    baseDate: string;
    baseClose: number;
    pct: number | null;
}

export type MacroChangeKey = '1week' | '1month' | '3months' | '1year';

export type MacroChanges = Record<MacroChangeKey, MacroChange | null>;

export interface MacroRange52w {
    high: number;
    highDate: string;
    low: number;
    lowDate: string;
    fromHighPct: number | null;
    fromLowPct: number | null;
}

/** 52주 범위의 한쪽 끝: 값과 그 값이 찍힌 날짜. */
interface RangeExtreme {
    value: number;
    date: string;
}

const WEEK_DAYS = 7;
const YEAR_DAYS = 365;

/**
 * 기준일 산식: 시세 날짜에서 7일 / 1·3·12달력월을 뺀 날짜. 달 단위는 `minusCalendarMonths`(말일 보정)를
 * 재사용한다(core 함수) — `calendarChange.ts`의 `calendarChangeView`는 봉의 마지막 종가를 기준으로 삼지만 여기서는
 * 실시간 시세 가격을 기준으로 삼고 입력도 `Bar`가 아니라 일봉 행이라 그 함수는 쓰지 않는다.
 */
const BASE_DATE_FOR: Record<MacroChangeKey, (quoteDate: string) => string> = {
    '1week': date => addUtcIsoDays(date, -WEEK_DAYS),
    '1month': date => minusCalendarMonths(date, 1),
    '3months': date => minusCalendarMonths(date, 3),
    '1year': date => minusCalendarMonths(date, 12),
};

/** 오래된 순 `rows`에서 `targetDate` 이전(포함) 마지막 거래일 행. 없으면 `null`. */
function lastRowOnOrBefore(
    rows: readonly YahooDailyClose[],
    targetDate: string
): YahooDailyClose | null {
    return rows.findLast(row => row.date <= targetDate) ?? null;
}

/**
 * 시세 가격을 기준일 종가와 비교한 변화율 4종. 일봉이 그 기준일까지 거슬러 올라가지 않으면 그 칸은 `null`.
 * `rows`는 오래된 순이다.
 */
export function macroChanges(
    price: number,
    quoteDate: string,
    rows: readonly YahooDailyClose[]
): MacroChanges {
    const change = (key: MacroChangeKey): MacroChange | null => {
        const base = lastRowOnOrBefore(rows, BASE_DATE_FOR[key](quoteDate));
        if (base === null) return null;
        return {
            baseDate: base.date,
            baseClose: base.close,
            pct: pctVs(price, base.close),
        };
    };
    return {
        '1week': change('1week'),
        '1month': change('1month'),
        '3months': change('3months'),
        '1year': change('1year'),
    };
}

/**
 * 최근 365일 일봉의 고가·저가(없으면 종가로 대체)에 **현재가를 접어 넣은** 52주 범위. 일봉은 1시간, 시세는
 * 1분 캐시라 시세가 캐시된 일봉의 고저를 벗어날 수 있다 — 그대로 두면 `fromHighPct`가 양수(고점보다 높은데
 * "고점 대비 +x%")가 된다. 현재가가 고저를 새로 쓰면 그 날짜는 시세 날짜(`quoteDate`)다. 같은 값이 여러
 * 날이면 가장 최근 날짜를 쓴다. 구간에 일봉이 없으면 `null`(현재가만으로 범위를 만들지 않는다).
 */
export function macroRange52w(
    price: number,
    quoteDate: string,
    rows: readonly YahooDailyClose[]
): MacroRange52w | null {
    const from = addUtcIsoDays(quoteDate, -YEAR_DAYS);
    const inWindow = rows.filter(
        row => row.date >= from && row.date <= quoteDate
    );
    if (inWindow.length === 0) return null;
    // `>=`·`<=`라 같은 값이 여러 날이면 뒤(최근) 행이 이긴다 — `rows`는 오래된 순이다.
    const rowHigh = inWindow
        .map(row => ({ value: row.high ?? row.close, date: row.date }))
        .reduce((best, next) => (next.value >= best.value ? next : best));
    const rowLow = inWindow
        .map(row => ({ value: row.low ?? row.close, date: row.date }))
        .reduce((best, next) => (next.value <= best.value ? next : best));
    const live: RangeExtreme = { value: price, date: quoteDate };
    const high = price > rowHigh.value ? live : rowHigh;
    const low = price < rowLow.value ? live : rowLow;
    return {
        high: high.value,
        highDate: high.date,
        low: low.value,
        lowDate: low.date,
        fromHighPct: pctVs(price, high.value),
        fromLowPct: pctVs(price, low.value),
    };
}
