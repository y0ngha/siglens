import type { MarketDataProvider, GetBarsOptions, Bar } from './types';
import { TIMEFRAME_LOOKBACK_DAYS } from '@/domain/constants/market';
import { getEasternOffsetHours } from '@/domain/time/eastern';

const BASE_URL = 'https://data.alpaca.markets/v2';

interface AlpacaBar {
    t: string; // timestamp (RFC3339)
    o: number; // open
    h: number; // high
    l: number; // low
    c: number; // close
    v: number; // volume
}

interface AlpacaBarsResponse {
    bars: AlpacaBar[];
    next_page_token: string | null;
}

function toBar(raw: AlpacaBar): Bar {
    return {
        time: Math.floor(new Date(raw.t).getTime() / 1000),
        open: raw.o,
        high: raw.h,
        low: raw.l,
        close: raw.c,
        volume: raw.v,
    };
}

export class AlpacaProvider implements MarketDataProvider {
    private readonly apiKey: string;
    private readonly secretKey: string;

    constructor() {
        const apiKey = process.env.ALPACA_API_KEY;
        const secretKey = process.env.ALPACA_SECRET_KEY;

        if (!apiKey || !secretKey) {
            throw new Error('ALPACA_API_KEY and ALPACA_SECRET_KEY must be set');
        }

        this.apiKey = apiKey;
        this.secretKey = secretKey;
    }

    async getBars(options: GetBarsOptions): Promise<Bar[]> {
        const { symbol, timeframe, limit = 500, before } = options;

        const lookbackMs =
            TIMEFRAME_LOOKBACK_DAYS[timeframe] * 24 * 60 * 60 * 1000;
        const endTime = before ? new Date(before) : new Date();
        const etOffsetMs = getEasternOffsetHours(endTime) * 3600 * 1000;
        const endTimeET = new Date(endTime.getTime() + etOffsetMs);
        const startTimeET = new Date(endTimeET.getTime() - lookbackMs);
        const startUtc = new Date(startTimeET.getTime() - etOffsetMs);

        const params = new URLSearchParams({
            timeframe,
            limit: String(limit),
            adjustment: 'raw',
            feed: 'iex',
            start: startUtc.toISOString(),
        });

        if (before) {
            params.set('end', before);
        }

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

        const data: AlpacaBarsResponse = await res.json();

        return (data.bars ?? []).map(toBar);
    }
}
