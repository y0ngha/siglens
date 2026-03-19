import type { MarketDataProvider, GetBarsOptions, Bar } from './types';

const BASE_URL = 'https://data.alpaca.markets/v2';

type AlpacaBar = {
  t: string; // timestamp (RFC3339)
  o: number; // open
  h: number; // high
  l: number; // low
  c: number; // close
  v: number; // volume
};

type AlpacaBarsResponse = {
  bars: AlpacaBar[];
  next_page_token: string | null;
};

function toBar(raw: AlpacaBar): Bar {
  return {
    timestamp: raw.t,
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

    const params = new URLSearchParams({
      timeframe,
      limit: String(limit),
      adjustment: 'raw',
      feed: 'iex',
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
      throw new Error(`Alpaca API error: ${res.status} ${res.statusText}`);
    }

    const data: AlpacaBarsResponse = await res.json();

    return data.bars.map(toBar);
  }
}
