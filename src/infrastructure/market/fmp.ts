import type {
    GetBarsOptions,
    Bar,
    Timeframe,
    MarketDataProvider,
} from './types';

const FMP_BASE_URL = 'https://financialmodelingprep.com/stable';
const FMP_REVALIDATE_SECONDS = 60;

// FMP intraday timestamps are in America/New_York (ET), not UTC.
// US DST: 2nd Sunday of March (spring forward) → 1st Sunday of November (fall back)
const EDT_OFFSET_HOURS = -4; // Eastern Daylight Time (DST period): UTC-4
const EST_OFFSET_HOURS = -5; // Eastern Standard Time (non-DST period): UTC-5
const DST_START_MONTH = 3; // March
const DST_START_NTH_SUNDAY = 2; // 2nd Sunday
const DST_END_MONTH = 11; // November
const DST_END_NTH_SUNDAY = 1; // 1st Sunday

function getNthSundayOfMonth(year: number, month: number, n: number): Date {
    const firstOfMonth = new Date(Date.UTC(year, month - 1, 1));
    const dayOfWeek = firstOfMonth.getUTCDay(); // 0 = Sunday
    const firstSunday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;
    return new Date(Date.UTC(year, month - 1, firstSunday + (n - 1) * 7));
}

function getEtOffsetHours(year: number, month: number, day: number): number {
    const dstStart = getNthSundayOfMonth(year, DST_START_MONTH, DST_START_NTH_SUNDAY);
    const dstEnd = getNthSundayOfMonth(year, DST_END_MONTH, DST_END_NTH_SUNDAY);
    const date = new Date(Date.UTC(year, month - 1, day));
    return date >= dstStart && date < dstEnd ? EDT_OFFSET_HOURS : EST_OFFSET_HOURS;
}

/**
 * FMP intraday timestamps are in America/New_York (ET), not UTC.
 * Converts "YYYY-MM-DD HH:MM:SS" ET string to Unix timestamp (UTC seconds).
 * DST is handled automatically using US rules (2nd Sun Mar → 1st Sun Nov).
 */
function fmpIntradayDateToUtcSeconds(dateStr: string): number {
    const year = Number(dateStr.substring(0, 4));
    const month = Number(dateStr.substring(5, 7));
    const day = Number(dateStr.substring(8, 10));
    const hour = Number(dateStr.substring(11, 13));
    const minute = Number(dateStr.substring(14, 16));
    const second = Number(dateStr.substring(17, 19));
    const etOffsetHours = getEtOffsetHours(year, month, day);
    // ET + |etOffset| = UTC  (etOffsetHours is negative, so we subtract it)
    const utcMs = Date.UTC(year, month - 1, day, hour - etOffsetHours, minute, second);
    return Math.floor(utcMs / 1000);
}

const FMP_INTRADAY_TIMEFRAME_MAP: Record<Exclude<Timeframe, '1Day'>, string> = {
    '5Min': '5min',
    '15Min': '15min',
    '30Min': '30min',
    '1Hour': '1hour',
    '4Hour': '4hour',
};

interface FmpBar {
    date: string; // "2024-01-15 09:30:00"
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

interface FmpDailyBar {
    date: string; // "2025-02-04"
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

interface FmpQuote {
    price: number; // 현재가 (당일 bar의 close로 사용)
    open: number;
    dayHigh: number;
    dayLow: number;
    volume: number;
    timestamp: number; // Unix timestamp (초 단위)
}

function toFmpBar(raw: FmpBar): Bar {
    return {
        time: fmpIntradayDateToUtcSeconds(raw.date),
        open: raw.open,
        high: raw.high,
        low: raw.low,
        close: raw.close,
        volume: raw.volume,
    };
}

function toFmpDailyBar(raw: FmpDailyBar): Bar {
    return {
        // 'T00:00:00'을 붙여 local time midnight으로 파싱한다.
        // date-only ISO 문자열(예: "2026-04-14")은 UTC midnight으로 파싱되어
        // US Eastern(UTC-4) 등의 타임존에서 하루 앞 날짜로 표시되는 버그가 있다.
        time: Math.floor(new Date(raw.date + 'T00:00:00').getTime() / 1000),
        open: raw.open,
        high: raw.high,
        low: raw.low,
        close: raw.close,
        volume: raw.volume,
    };
}

export class FmpProvider implements MarketDataProvider {
    private readonly apiKey: string;

    constructor() {
        const apiKey = process.env.FMP_API_KEY;

        if (!apiKey) {
            throw new Error('FMP_API_KEY must be set');
        }

        this.apiKey = apiKey;
    }

    private buildIntradayUrl(
        symbol: string,
        fmpTimeframe: string,
        fromDate: string | undefined,
        endDate: string | undefined
    ): string {
        const params = new URLSearchParams({ apikey: this.apiKey });

        params.set('symbol', symbol);

        if (fromDate !== undefined) {
            params.set('from', fromDate);
        }

        if (endDate !== undefined) {
            params.set('to', endDate);
        }

        return `${FMP_BASE_URL}/historical-chart/${fmpTimeframe}?${params}`;
    }

    private buildDailyUrl(
        symbol: string,
        fromDate: string | undefined,
        endDate: string | undefined
    ): string {
        const params = new URLSearchParams({ apikey: this.apiKey });

        params.set('symbol', symbol);

        if (fromDate !== undefined) {
            params.set('from', fromDate);
        }

        if (endDate !== undefined) {
            params.set('to', endDate);
        }

        return `${FMP_BASE_URL}/historical-price-eod/full?${params}`;
    }

    private buildQuoteUrl(symbol: string): string {
        const params = new URLSearchParams({ apikey: this.apiKey });
        params.set('symbol', symbol);
        return `${FMP_BASE_URL}/quote?${params}`;
    }

    // FMP API는 limit 파라미터를 지원하지 않습니다.
    // from 파라미터는 from 쿼리로, before 파라미터는 to 쿼리로 변환합니다.
    // Daily(1Day) 타임프레임은 /stable/historical-price-eod/full 엔드포인트를 사용합니다.
    async getBars(options: GetBarsOptions): Promise<Bar[]> {
        const { symbol, timeframe, before, from } = options;

        const fromDate = from !== undefined ? from.substring(0, 10) : undefined;
        const endDate =
            before !== undefined ? before.substring(0, 10) : undefined;

        if (timeframe === '1Day') {
            return this.getDailyBars(symbol, fromDate, endDate);
        }

        // timeframe !== '1Day' is guaranteed by the branch above
        const intradayTimeframe = timeframe as Exclude<Timeframe, '1Day'>;
        const fmpTimeframe = FMP_INTRADAY_TIMEFRAME_MAP[intradayTimeframe];
        return this.getIntradayBars(symbol, fmpTimeframe, fromDate, endDate);
    }

    private async getIntradayBars(
        symbol: string,
        fmpTimeframe: string,
        fromDate: string | undefined,
        endDate: string | undefined
    ): Promise<Bar[]> {
        const url = this.buildIntradayUrl(
            symbol,
            fmpTimeframe,
            fromDate,
            endDate
        );

        const res = await fetch(url, {
            next: { revalidate: FMP_REVALIDATE_SECONDS },
        });

        if (!res.ok) {
            throw new Error(`FMP API error: ${res.status} ${res.statusText}`);
        }

        // res.json() returns unknown; asserting shape against FMP API contract
        const raw = (await res.json()) as FmpBar[];

        if (!Array.isArray(raw)) {
            return [];
        }

        return raw.map(r => toFmpBar(r)).toReversed();
    }

    private async getDailyBars(
        symbol: string,
        fromDate: string | undefined,
        endDate: string | undefined
    ): Promise<Bar[]> {
        const eodUrl = this.buildDailyUrl(symbol, fromDate, endDate);

        // endDate가 지정된 경우 과거 데이터 조회이므로 당일 quote를 추가하지 않는다.
        const [eodRes, todayBar] = await Promise.all([
            fetch(eodUrl, { next: { revalidate: FMP_REVALIDATE_SECONDS } }),
            endDate === undefined
                ? this.fetchTodayQuoteBar(symbol)
                : Promise.resolve(null),
        ]);

        if (!eodRes.ok) {
            throw new Error(
                `FMP API error: ${eodRes.status} ${eodRes.statusText}`
            );
        }

        // eodRes.json() returns unknown; asserting shape against FMP API contract
        const raw = (await eodRes.json()) as FmpDailyBar[];

        if (!Array.isArray(raw)) {
            return [];
        }

        const eodBars = raw.map(r => toFmpDailyBar(r)).toReversed();

        if (todayBar === null) return eodBars;

        // 마지막 EOD 봉이 당일 quote 봉과 같거나 이후이면 장 마감 후 EOD에 이미 포함된 것
        const lastBar = eodBars.at(-1);
        if (lastBar !== undefined && lastBar.time >= todayBar.time) {
            return eodBars;
        }

        return [...eodBars, todayBar];
    }

    /**
     * 당일 실시간 quote를 Bar 형태로 반환한다.
     * 실패 시 null을 반환하여 EOD 데이터만으로 graceful degradation한다.
     *
     * EOD 조회 실패(throw)와 달리 quote 실패는 전체 요청을 실패시키지 않는 의도적 비대칭 처리다.
     * quote는 당일 봉 보강용 부가 데이터이므로 실패해도 차트 렌더링에 치명적이지 않다.
     * 반면 EOD 데이터는 차트의 핵심이므로 실패 시 즉시 throw한다.
     *
     * 주의: timestamp에서 UTC 날짜를 추출하므로 정규장 시간(9:30 AM – 4:00 PM ET) 내에서만
     * ET 거래일과 날짜가 일치한다. 애프터마켓(예: 8:00 PM ET = 익일 01:00 UTC)의 경우
     * UTC 날짜가 ET 거래일보다 하루 앞설 수 있으나, FMP /stable/quote는 정규장 기준
     * 당일 데이터를 반환하므로 현재 구현 범위에서는 문제없다.
     */
    private async fetchTodayQuoteBar(symbol: string): Promise<Bar | null> {
        const url = this.buildQuoteUrl(symbol);
        try {
            const res = await fetch(url, {
                next: { revalidate: FMP_REVALIDATE_SECONDS },
            });
            if (!res.ok) return null;

            // res.json() returns unknown; FMP quote API response shape guaranteed by provider contract
            const raw = (await res.json()) as FmpQuote[];
            if (!Array.isArray(raw) || raw.length === 0) return null;

            const quote = raw[0]!;
            const d = new Date(quote.timestamp * 1000);
            const dateStr = d.toISOString().split('T')[0]!;

            return {
                time: Math.floor(
                    new Date(dateStr + 'T00:00:00').getTime() / 1000
                ),
                open: quote.open,
                high: quote.dayHigh,
                low: quote.dayLow,
                close: quote.price,
                volume: quote.volume,
            };
        } catch (error) {
            console.warn(
                '[FmpProvider] Failed to fetch today quote, using EOD data only:',
                error
            );
            return null;
        }
    }
}
