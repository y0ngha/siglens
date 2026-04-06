import type {
    GetBarsOptions,
    Bar,
    Timeframe,
    MarketDataProvider,
} from './types';

const FMP_BASE_URL = 'https://financialmodelingprep.com/stable';

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

export class FmpProvider implements MarketDataProvider {
    private readonly apiKey: string;

    constructor() {
        const apiKey = process.env.FMP_API_KEY;

        if (!apiKey) {
            throw new Error('FMP_API_KEY must be set');
        }

        this.apiKey = apiKey;
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

    // FMP API는 limit 파라미터를 지원하지 않습니다.
    // before 파라미터만 to 쿼리로 변환합니다.
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

        if (!Array.isArray(raw)) {
            return [];
        }

        return raw.map(r => toFmpBar(r)).toReversed();
    }
}
