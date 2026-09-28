import 'server-only';
import type { MarketDailyClose } from '@y0ngha/siglens-core';
import { getYahooClient } from '@/shared/api/yahoo/createYahooClient';
import { isE2E } from '@/shared/api/e2eEnv';
import { ISO_DATE_LENGTH, MS_PER_DAY } from '@/shared/config/time';
import { e2eDailyCloses } from './e2eFearGreedFixture';
import { MARKET_FEAR_GREED_KR_LOOKBACK_DAYS } from './marketFearGreedKrSymbols';

/**
 * 조회 창의 하한. 캐시 계층이 한 번 계산해 모든 시리즈에 같은 값을 넘긴다 —
 * 시리즈별로 파생하면 자정을 걸친 요청이 시리즈마다 다른 창을 받는다.
 */
export function krLookbackStartDate(now: Date): Date {
    return new Date(
        now.getTime() - MARKET_FEAR_GREED_KR_LOOKBACK_DAYS * MS_PER_DAY
    );
}

/** yahoo `chart` 응답에서 우리가 쓰는 부분집합. 라이브러리 타입은 interval별 유니온이라 좁혀 받는다. */
interface YahooChartRow {
    date?: unknown;
    close?: unknown;
    adjclose?: unknown;
}

function isUsablePrice(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

/**
 * 시리즈 전체가 `adjclose`를 쓸 수 있는지 — 행별이 아니라 **시리즈 단위**로
 * 결정한다.
 *
 * 행마다 adjclose→close로 개별 폴백하면 한 시리즈 안에 조정가와 미조정가가
 * 섞인다. 배당락일 행만 adjclose가 비어 close로 떨어지면, 그 행만 배당락
 * 하락분이 남아 20세션 수익률 스프레드에 가짜 낙폭을 다시 심는다(미국
 * 경로의 배당 조정 이유와 동일 — `fetchDailyCloses` 참고). `close`가 있는
 * 행 전부가 `adjclose`도 갖고 있을 때만 시리즈 전체를 adjclose로 쓰고,
 * 하나라도 어긋나면 시리즈 전체를 close로 통일한다.
 */
function shouldUseAdjClose(rows: YahooChartRow[]): boolean {
    return rows.every(row => {
        if (!isUsablePrice(row.close)) return true;
        return isUsablePrice(row.adjclose);
    });
}

/** 시리즈 결정(`shouldUseAdjClose`)에 따라 한 행의 종가를 고른다. */
function selectPrice(row: YahooChartRow, useAdjClose: boolean): number | null {
    if (useAdjClose) {
        return isUsablePrice(row.adjclose) ? row.adjclose : null;
    }
    return isUsablePrice(row.close) ? row.close : null;
}

/**
 * 한 티커의 일별 종가 — yahoo `chart`.
 *
 * **미국 경로(`fetchDailyCloses`)와 대칭이되 소스만 다르다.** FMP 플랜에 KRX가
 * 없어서다. `getBarsStatic`을 타지 않는 이유도 같다: 그 경로는 지표 전체를 계산해
 * 심볼당 ~500KB를 만드는데, 여기 필요한 건 숫자 하나짜리 시계열이다.
 *
 * 날짜는 **KST 달력일**로 변환한다. yahoo가 주는 `Date`는 장 마감 UTC 인스턴트라
 * `toISOString().slice(0,10)`을 쓰면 15:30 KST 마감이 같은 날 06:30 UTC로 잘 맞지만,
 * 서머타임 없는 KST라도 다른 시리즈(원화 24시간물 등)를 섞을 때 하루가 밀릴 수 있다.
 * core가 여섯 시리즈를 날짜로 inner join하므로 하루만 어긋나도 표본이 통째로 비는데,
 * 그건 "표본 부족"으로만 보이고 원인이 로그에 남지 않는다.
 *
 * @throws 사용 가능한 행이 하나도 없을 때. 조용한 빈 배열은 `getOrSetCache`가
 *   그대로 캐시해 버려, 업스트림 장애가 "표본이 부족합니다" 화면으로 굳는다.
 */
export async function fetchKrDailyCloses(
    symbol: string,
    from: Date,
    to: Date
): Promise<MarketDailyClose[]> {
    // E2E는 외부 키·네트워크 없이 도는 것이 의도된 설계다. 미국 경로와 같은 결정적
    // fixture를 재사용해 게이지·비교·요인 막대까지 실제로 렌더시킨다.
    if (isE2E()) return e2eDailyCloses(symbol);

    const client = getYahooClient();
    const result = await client.chart(symbol, {
        period1: from,
        period2: to,
        interval: '1d',
    });

    const rows = (result?.quotes ?? []) as unknown as YahooChartRow[];
    const useAdjClose = shouldUseAdjClose(rows);
    const closes = rows.flatMap(row => {
        const price = selectPrice(row, useAdjClose);
        return row.date instanceof Date && price !== null
            ? [{ date: toKstDate(row.date), close: price }]
            : [];
    });

    if (closes.length === 0) {
        throw new Error(
            `[marketFearGreedKr] no usable closes for ${symbol} (${from.toISOString().slice(0, ISO_DATE_LENGTH)}..${to.toISOString().slice(0, ISO_DATE_LENGTH)})`
        );
    }

    return closes;
}

const KST_DATE_FORMAT = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'Asia/Seoul',
});

/** UTC 인스턴트 → KST 달력일 `YYYY-MM-DD`. `en-CA`가 곧 ISO 순서라 재조립이 없다. */
function toKstDate(instant: Date): string {
    return KST_DATE_FORMAT.format(instant);
}
