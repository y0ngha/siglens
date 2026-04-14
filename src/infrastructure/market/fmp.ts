import type {
    GetBarsOptions,
    Bar,
    Timeframe,
    MarketDataProvider,
} from './types';

const FMP_BASE_URL = 'https://financialmodelingprep.com/stable';

const FMP_INTRADAY_TIMEFRAME_MAP: Record<Exclude<Timeframe, '1Day'>, string> = {
    '1Min': '1min',
    '5Min': '5min',
    '15Min': '15min',
    '1Hour': '1hour',
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
        time: Math.floor(new Date(raw.date + ' UTC').getTime() / 1000),
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
        const params = new URLSearchParams({ apikey: this.apiKey, symbol });
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
            next: { revalidate: 60 },
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
            fetch(eodUrl, { next: { revalidate: 60 } }),
            endDate === undefined
                ? this.fetchTodayQuoteBar(symbol)
                : Promise.resolve(null),
        ]);

        if (!eodRes.ok) {
            throw new Error(
                `FMP API error: ${eodRes.status} ${eodRes.statusText}`
            );
        }

        // res.json() returns unknown; asserting shape against FMP API contract
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
     * (EOD 조회 실패와 달리 전체 요청을 실패시키지 않는 의도적 비대칭 처리)
     */
    private async fetchTodayQuoteBar(symbol: string): Promise<Bar | null> {
        const url = this.buildQuoteUrl(symbol);
        try {
            const res = await fetch(url, { next: { revalidate: 60 } });
            if (!res.ok) return null;

            // res.json() returns unknown; FMP quote API response shape guaranteed by provider contract
            const raw = (await res.json()) as FmpQuote[];
            if (!Array.isArray(raw) || raw.length === 0) return null;

            const quote = raw[0]!;
            const d = new Date(quote.timestamp * 1000);
            const dateStr = [
                d.getUTCFullYear(),
                String(d.getUTCMonth() + 1).padStart(2, '0'),
                String(d.getUTCDate()).padStart(2, '0'),
            ].join('-');

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
