import type {
    GetBarsOptions,
    Bar,
    Timeframe,
    MarketDataProvider,
} from './types';

const FMP_BASE_URL = 'https://financialmodelingprep.com/api/v3';

const FMP_TIMEFRAME_MAP: Record<Timeframe, string> = {
    '1Min': '1min',
    '5Min': '5min',
    '15Min': '15min',
    '1Hour': '1hour',
    '1Day': '1day',
};

interface FmpBar {
    date: string; // "2024-01-15 09:30:00"
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
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

    private toBar(raw: FmpBar): Bar {
        return {
            time: Math.floor(new Date(raw.date + ' UTC').getTime() / 1000),
            open: raw.open,
            high: raw.high,
            low: raw.low,
            close: raw.close,
            volume: raw.volume,
        };
    }

    private buildUrl(
        options: GetBarsOptions,
        endDate: string | undefined
    ): string {
        const { symbol, timeframe } = options;
        const fmpTimeframe = FMP_TIMEFRAME_MAP[timeframe];

        const params = new URLSearchParams({ apikey: this.apiKey });

        if (endDate !== undefined) {
            params.set('to', endDate);
        }

        return `${FMP_BASE_URL}/historical-chart/${fmpTimeframe}/${symbol}?${params}`;
    }

    async getBars(options: GetBarsOptions): Promise<Bar[]> {
        const { before } = options;

        const endDate =
            before !== undefined ? before.substring(0, 10) : undefined;

        const url = this.buildUrl(options, endDate);

        const res = await fetch(url, {
            next: { revalidate: 60 },
        });

        if (!res.ok) {
            throw new Error(`FMP API error: ${res.status} ${res.statusText}`);
        }

        // res.json() returns unknown; asserting shape against FMP API contract
        const raw = (await res.json()) as FmpBar[];

        return raw.map(r => this.toBar(r)).toReversed();
    }
}
