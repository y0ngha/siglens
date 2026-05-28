import type {
    GetBarsOptions,
    MarketDataProvider,
    Bar,
    MarketQuote,
    Timeframe,
} from '@y0ngha/siglens-core';
import { MS_PER_SECOND } from '@/shared/config/time';
import { fmpGet } from '@/shared/api/fmp/httpClient';

const ISO_DATE_PREFIX_LENGTH = 10; // "YYYY-MM-DD"
const ISO_DATE_PART_INDEX = 0;

const EDT_OFFSET_HOURS = -4;
const EST_OFFSET_HOURS = -5;
const DST_START_MONTH = 3;
const DST_START_NTH_SUNDAY = 2;
const DST_END_MONTH = 11;
const DST_END_NTH_SUNDAY = 1;

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

function getNthSundayOfMonth(year: number, month: number, n: number): Date {
    const firstOfMonth = new Date(Date.UTC(year, month - 1, 1));
    const dayOfWeek = firstOfMonth.getUTCDay();
    const firstSunday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;
    return new Date(Date.UTC(year, month - 1, firstSunday + (n - 1) * 7));
}

function getEtOffsetHours(year: number, month: number, day: number): number {
    const dstStart = getNthSundayOfMonth(
        year,
        DST_START_MONTH,
        DST_START_NTH_SUNDAY
    );
    const dstEnd = getNthSundayOfMonth(year, DST_END_MONTH, DST_END_NTH_SUNDAY);
    const date = new Date(Date.UTC(year, month - 1, day));
    return date >= dstStart && date < dstEnd
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
