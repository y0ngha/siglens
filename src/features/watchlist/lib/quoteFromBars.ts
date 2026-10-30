import type { Bar } from '@y0ngha/siglens-core';

/** 관심종목 행 한 줄의 시세 — 봉 캐시에서 만든다. */
export interface WatchlistQuote {
    price: number;
    /** 직전 종가 대비 %. 직전 종가가 0이면 null. */
    changePct: number | null;
    /** 미니 차트용 최근 종가(오래된 것부터). 같은 봉에서 뽑으므로 추가 요청이 없다. */
    trend: number[];
}

const PERCENT = 100;
/** 미니 차트가 그리는 종가 개수 — 일봉 기준 "5일 흐름". */
export const QUOTE_TREND_LENGTH = 5;

/** 봉 두 개로 "현재가·등락률"을 만든다 — 별도 시세 API 없이 봉 캐시(`QUERY_KEYS.bars`)를 재사용하기 위해서다. */
export function quoteFromBars(bars: readonly Bar[]): WatchlistQuote | null {
    const last = bars[bars.length - 1];
    const prev = bars[bars.length - 2];
    if (last === undefined || prev === undefined) return null;
    const changePct =
        prev.close > 0
            ? ((last.close - prev.close) / prev.close) * PERCENT
            : null;
    const trend = bars.slice(-QUOTE_TREND_LENGTH).map(b => b.close);
    return { price: last.close, changePct, trend };
}
