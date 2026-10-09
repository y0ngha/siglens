import type { Bar } from '@y0ngha/siglens-core';

export interface WatchlistQuote {
    price: number;
    /** 직전 종가 대비 %. 직전 종가가 0이면 null. */
    changePct: number | null;
}

const PERCENT = 100;

/** 봉 두 개로 "현재가·등락률"을 만든다 — 별도 시세 API 없이 봉 캐시(`QUERY_KEYS.bars`)를 재사용하기 위해서다. */
export function quoteFromBars(bars: readonly Bar[]): WatchlistQuote | null {
    if (bars.length < 2) return null;
    const last = bars[bars.length - 1]!;
    const prev = bars[bars.length - 2]!;
    const changePct =
        prev.close > 0
            ? ((last.close - prev.close) / prev.close) * PERCENT
            : null;
    return { price: last.close, changePct };
}
