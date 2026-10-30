import type { MarketDailyClose } from '@y0ngha/siglens-core';
import { kstDateKey } from '@/shared/lib/etTimeUtils';

/** yahoo `chart` 행에서 쓰는 필드. 외부 응답이라 `unknown`으로 받아 값마다 좁힌다. */
type YahooQuoteRow = Record<'date' | 'close' | 'adjclose', unknown>;

function isUsablePrice(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function toQuoteRows(quotes: unknown): YahooQuoteRow[] {
    if (!Array.isArray(quotes)) return [];
    return quotes.map((row: Partial<YahooQuoteRow>) => ({
        date: row.date,
        close: row.close,
        adjclose: row.adjclose,
    }));
}

/**
 * 시리즈 전체가 `adjclose`를 쓸 수 있는지 — 행별이 아니라 **시리즈 단위**로 결정한다.
 *
 * 행마다 adjclose→close로 개별 폴백하면 한 시리즈 안에 조정가와 미조정가가 섞인다.
 * 배당락일 행만 adjclose가 비어 close로 떨어지면, 그 행만 배당락 하락분이 남아 20세션
 * 수익률 스프레드에 가짜 낙폭을 다시 심는다(미국 경로의 배당 조정 이유와 동일 —
 * `fetchDailyCloses` 참고). `close`가 있는 행 전부가 `adjclose`도 갖고 있을 때만 시리즈
 * 전체를 adjclose로 쓰고, 하나라도 어긋나면 시리즈 전체를 close로 통일한다.
 */
function shouldUseAdjClose(rows: readonly YahooQuoteRow[]): boolean {
    return rows.every(
        row => !isUsablePrice(row.close) || isUsablePrice(row.adjclose)
    );
}

function selectPrice(row: YahooQuoteRow, useAdjClose: boolean): number | null {
    const price = useAdjClose ? row.adjclose : row.close;
    return isUsablePrice(price) ? price : null;
}

/**
 * yahoo `chart`의 `quotes`를 KST 달력일 키 종가 시리즈로 바꾼다.
 *
 * `Date`가 아닌 `date`나 쓸 수 있는 가격이 없는 행은 버린다. 가격 필드(adjclose/close)는
 * 시리즈 단위로 하나만 고른다(`shouldUseAdjClose`). 날짜 키가 KST인 이유는
 * `fetchKrDailyCloses` JSDoc 참고. 배열이 아닌 입력은 빈 배열이고, `null` 원소는 속성 접근에서 던진다(호출부가 reject).
 */
export function parseYahooDailyCloses(quotes: unknown): MarketDailyClose[] {
    const rows = toQuoteRows(quotes);
    const useAdjClose = shouldUseAdjClose(rows);
    return rows.flatMap(row => {
        const price = selectPrice(row, useAdjClose);
        return row.date instanceof Date && price !== null
            ? [{ date: kstDateKey(row.date), close: price }]
            : [];
    });
}
