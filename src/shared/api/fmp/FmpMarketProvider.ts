import type {
    GetBarsOptions,
    MarketDataProvider,
    Bar,
    MarketQuote,
    Timeframe,
} from '@y0ngha/siglens-core';
import { MS_PER_SECOND } from '@/shared/config/time';
import { fmpGet } from '@/shared/api/fmp/httpClient';
import {
    MARCH,
    NOVEMBER,
    SECOND_SUNDAY,
    FIRST_SUNDAY,
    EDT_OFFSET_HOURS,
    EST_OFFSET_HOURS,
    nthSundayDay,
} from '@/shared/lib/eastern';

const ISO_DATE_PREFIX_LENGTH = 10; // "YYYY-MM-DD"
const ISO_DATE_PART_INDEX = 0;

// FMP ET→UTC timestamp conversion. Canonical home after the market-provider
// ejection: siglens-core no longer fetches market data (it owns only the
// MarketDataProvider port), so this logic permanently lives in siglens.
//
// DST 날짜 계산은 eastern.ts의 nthSundayDay를 정규 원시 함수로 위임한다.
// FMP API 날짜 문자열은 1-indexed month이므로 0-indexed(MARCH=2, NOVEMBER=10)로 변환해 전달한다.

const FMP_DATETIME_YEAR_END = 4;
const FMP_DATETIME_MONTH_START = 5;
const FMP_DATETIME_MONTH_END = 7;
const FMP_DATETIME_DAY_START = 8;
const FMP_DATETIME_DAY_END = 10;
const FMP_DATETIME_HOUR_START = 11;
const FMP_DATETIME_HOUR_END = 13;
const FMP_DATETIME_MINUTE_START = 14;
const FMP_DATETIME_MINUTE_END = 16;
const FMP_DATETIME_SECOND_START = 17;
const FMP_DATETIME_SECOND_END = 19;

/**
 * FMP 날짜 문자열의 연도·1-indexed 월·일을 받아 ET UTC 오프셋을 반환한다.
 *
 * date-only 비교: FMP 장중 데이터의 시각은 항상 09:30~16:00 ET이고
 * DST 전환 기준 시각(02:00 ET)보다 늦으므로 날짜 단위 비교로 오프셋을 정확히 결정할 수 있다.
 * hour 인수를 받지 않는 이 설계는 의도적이며 기존 동작을 보존한다.
 *
 * @param year  - 연도
 * @param month - 1-indexed 월 (FMP 날짜 문자열 원본 값)
 * @param day   - day-of-month
 * @returns EDT(-4) 또는 EST(-5)
 */
function getEtOffsetHours(year: number, month: number, day: number): number {
    // nthSundayDay는 0-indexed month를 받으므로 MARCH(2), NOVEMBER(10)을 직접 사용
    const springDay = nthSundayDay(year, MARCH, SECOND_SUNDAY);
    const fallDay = nthSundayDay(year, NOVEMBER, FIRST_SUNDAY);

    // date-only UTC 자정 기준 비교 (기존 동작 보존)
    const dateMs = Date.UTC(year, month - 1, day);
    const springMs = Date.UTC(year, MARCH, springDay);
    const fallMs = Date.UTC(year, NOVEMBER, fallDay);

    return dateMs >= springMs && dateMs < fallMs
        ? EDT_OFFSET_HOURS
        : EST_OFFSET_HOURS;
}

function fmpIntradayDateToUtcSeconds(dateStr: string): number {
    const year = Number(dateStr.substring(0, FMP_DATETIME_YEAR_END));
    const month = Number(
        dateStr.substring(FMP_DATETIME_MONTH_START, FMP_DATETIME_MONTH_END)
    );
    const day = Number(
        dateStr.substring(FMP_DATETIME_DAY_START, FMP_DATETIME_DAY_END)
    );
    const hour = Number(
        dateStr.substring(FMP_DATETIME_HOUR_START, FMP_DATETIME_HOUR_END)
    );
    const minute = Number(
        dateStr.substring(FMP_DATETIME_MINUTE_START, FMP_DATETIME_MINUTE_END)
    );
    const second = Number(
        dateStr.substring(FMP_DATETIME_SECOND_START, FMP_DATETIME_SECOND_END)
    );
    const etOffsetHours = getEtOffsetHours(year, month, day);
    const utcMs = Date.UTC(
        year,
        month - 1,
        day,
        hour - etOffsetHours,
        minute,
        second
    );
    return Math.floor(utcMs / MS_PER_SECOND);
}

const FMP_INTRADAY_TIMEFRAME_MAP: Record<Exclude<Timeframe, '1Day'>, string> = {
    '5Min': '5min',
    '15Min': '15min',
    '30Min': '30min',
    '1Hour': '1hour',
    '4Hour': '4hour',
};

interface FmpOhlcvBar {
    date: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}
interface FmpQuote {
    price: number;
    open: number;
    dayHigh: number;
    dayLow: number;
    volume: number;
    timestamp: number;
    changePercentage: number;
    name: string;
}

function toFmpBar(raw: FmpOhlcvBar): Bar {
    return {
        time: fmpIntradayDateToUtcSeconds(raw.date),
        open: raw.open,
        high: raw.high,
        low: raw.low,
        close: raw.close,
        volume: raw.volume,
    };
}

function toFmpDailyBar(raw: FmpOhlcvBar): Bar {
    // UTC midnight (Z): deterministic regardless of server TZ and consistent with the
    // intraday path's ET→UTC conversion. (lightweight-charts expects UTC.)
    return {
        time: Math.floor(
            new Date(raw.date + 'T00:00:00Z').getTime() / MS_PER_SECOND
        ),
        open: raw.open,
        high: raw.high,
        low: raw.low,
        close: raw.close,
        volume: raw.volume,
    };
}

function buildBarsQuery(
    symbol: string,
    fromDate: string | undefined,
    endDate: string | undefined
): Record<string, string> {
    return {
        symbol,
        ...(fromDate !== undefined ? { from: fromDate } : {}),
        ...(endDate !== undefined ? { to: endDate } : {}),
    };
}

/**
 * FMP adapter for the core `MarketDataProvider` port. Fetches bars/quotes via
 * the shared `fmpGet` HTTP client (retry + structured FmpHttpError). Quote
 * failures degrade to `null`; bar failures propagate (after fmpGet's retries).
 */
export class FmpMarketProvider implements MarketDataProvider {
    async getBars(options: GetBarsOptions): Promise<Bar[]> {
        // `options.limit` is intentionally not forwarded: this adapter bounds
        // results by the `from`/`before` date window, because the FMP historical
        // endpoints used here (`historical-chart/*`, `historical-price-eod/full`)
        // are date-ranged, not count-limited. Callers must scope by date window.
        const { symbol, timeframe, before, from } = options;
        const fromDate = from?.substring(0, ISO_DATE_PREFIX_LENGTH);
        const endDate = before?.substring(0, ISO_DATE_PREFIX_LENGTH);

        if (timeframe === '1Day') {
            return this.getDailyBars(symbol, fromDate, endDate);
        }
        // Safe: the '1Day' branch returned above, so timeframe is guaranteed non-'1Day' here.
        const fmpTimeframe =
            FMP_INTRADAY_TIMEFRAME_MAP[timeframe as Exclude<Timeframe, '1Day'>];
        const raw = await fmpGet<FmpOhlcvBar[]>(
            `historical-chart/${fmpTimeframe}`,
            buildBarsQuery(symbol, fromDate, endDate)
        );
        if (!Array.isArray(raw)) return [];
        return raw.map(r => toFmpBar(r)).toReversed();
    }

    private async getDailyBars(
        symbol: string,
        fromDate: string | undefined,
        endDate: string | undefined
    ): Promise<Bar[]> {
        const [raw, todayBar] = await Promise.all([
            fmpGet<FmpOhlcvBar[]>(
                'historical-price-eod/full',
                buildBarsQuery(symbol, fromDate, endDate)
            ),
            endDate === undefined
                ? this.fetchTodayQuoteBar(symbol)
                : Promise.resolve(null),
        ]);
        if (!Array.isArray(raw)) return [];
        const eodBars = raw.map(r => toFmpDailyBar(r)).toReversed();
        if (todayBar === null) return eodBars;
        const lastBar = eodBars.at(-1);
        if (lastBar !== undefined && lastBar.time >= todayBar.time)
            return eodBars;
        return [...eodBars, todayBar];
    }

    async getQuote(symbol: string): Promise<MarketQuote | null> {
        try {
            const raw = await fmpGet<FmpQuote[]>('quote', { symbol });
            if (!Array.isArray(raw) || raw.length === 0) return null;
            const quote = raw[0]!;
            return {
                symbol,
                price: quote.price,
                changesPercentage: quote.changePercentage,
                name: quote.name ?? symbol,
            };
        } catch (error) {
            console.warn('[FmpMarketProvider] getQuote failed:', symbol, error);
            return null;
        }
    }

    private async fetchTodayQuoteBar(symbol: string): Promise<Bar | null> {
        try {
            const raw = await fmpGet<FmpQuote[]>('quote', { symbol });
            if (!Array.isArray(raw) || raw.length === 0) return null;
            const quote = raw[0]!;
            const d = new Date(quote.timestamp * MS_PER_SECOND);
            const dateStr = d.toISOString().split('T')[ISO_DATE_PART_INDEX]!;
            return {
                time: Math.floor(
                    new Date(dateStr + 'T00:00:00Z').getTime() / MS_PER_SECOND
                ),
                open: quote.open,
                high: quote.dayHigh,
                low: quote.dayLow,
                close: quote.price,
                volume: quote.volume,
            };
        } catch (error) {
            console.warn(
                '[FmpMarketProvider] today-quote fetch failed:',
                error
            );
            return null;
        }
    }
}
