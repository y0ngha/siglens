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
        time: Math.floor(new Date(raw.date).getTime() / 1000),
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
        const url = this.buildDailyUrl(symbol, fromDate, endDate);

        const res = await fetch(url, {
            next: { revalidate: 60 },
        });

        if (!res.ok) {
            throw new Error(`FMP API error: ${res.status} ${res.statusText}`);
        }

        // res.json() returns unknown; asserting shape against FMP API contract
        const raw = (await res.json()) as FmpDailyBar[];

        if (!Array.isArray(raw)) {
            return [];
        }

        return raw.map(r => toFmpDailyBar(r)).toReversed();
    }
}
