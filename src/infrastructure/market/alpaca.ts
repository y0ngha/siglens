import type { GetBarsOptions, Bar, MarketDataProvider } from './types';

const BASE_URL = 'https://data.alpaca.markets/v2';

interface AlpacaBar {
    t: string; // timestamp (RFC3339)
    o: number; // open
    h: number; // high
    l: number; // low
    c: number; // close
    v: number; // volume
}

interface AlpacaBarsRawResponse {
    bars?: AlpacaBar[];
}

export class AlpacaProvider implements MarketDataProvider {
    private readonly apiKey: string;
    private readonly secretKey: string;

    constructor() {
        const apiKey = process.env.ALPACA_API_KEY;
        const secretKey =
            process.env.ALPACA_API_SECRET ?? process.env.ALPACA_SECRET_KEY;

        if (!apiKey || !secretKey) {
            throw new Error(
                'ALPACA_API_KEY and (ALPACA_API_SECRET or ALPACA_SECRET_KEY) must be set'
            );
        }

        this.apiKey = apiKey;
        this.secretKey = secretKey;
    }

    private toBar(raw: AlpacaBar): Bar {
        return {
            time: Math.floor(new Date(raw.t).getTime() / 1000),
            open: raw.o,
            high: raw.h,
            low: raw.l,
            close: raw.c,
            volume: raw.v,
        };
    }

    async getBars(
        options: GetBarsOptions,
        now: string = new Date().toISOString()
    ): Promise<Bar[]> {
        const { symbol, timeframe, limit = 500, before } = options;

        const endTime = before ?? now;

        const params = new URLSearchParams({
            timeframe,
            limit: String(limit),
            adjustment: 'raw',
            feed: 'iex',
            end: endTime,
        });

        const url = `${BASE_URL}/stocks/${symbol}/bars?${params}`;

        const res = await fetch(url, {
            headers: {
                'APCA-API-KEY-ID': this.apiKey,
                'APCA-API-SECRET-KEY': this.secretKey,
            },
            next: { revalidate: 60 },
        });

        if (!res.ok) {
            throw new Error(
                `Alpaca API error: ${res.status} ${res.statusText}`
            );
        }

        // res.json() returns unknown; asserting shape against Alpaca API contract
        const raw = (await res.json()) as AlpacaBarsRawResponse;

        return (raw.bars ?? []).map(r => this.toBar(r));
    }
}
