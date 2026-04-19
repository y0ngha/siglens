import type {
    Bar,
    SectorSignalsResult,
    StockSignalResult,
    Timeframe,
} from '@/domain/types';
import { SECTOR_STOCKS } from '@/domain/constants/dashboard-tickers';
import type { DashboardTimeframe } from '@/domain/constants/dashboard-tickers';
import { calculateIndicators } from '@/domain/indicators';
import { classifyTrend, detectSignals } from '@/domain/signals';
import { createCacheProvider } from '@/infrastructure/cache/redis';
import { createMarketDataProvider } from '@/infrastructure/market/factory';

// TTL per timeframe (seconds) — matches data update cadence
// 1Day: daily bars change once a day; 1Hour: bars complete hourly; 15Min: 15-min intervals.
// Intentionally independent from ANALYSIS_CACHE_TTL constants.
const TTL_BY_TIMEFRAME: Record<DashboardTimeframe, number> = {
    '1Day': 3600, // 1h
    '1Hour': 900, // 15min
    '15Min': 300, // 5min
};

// 'from' lookback in days per timeframe — covers SQUEEZE_LOOKBACK_BARS=120 + buffer
const LOOKBACK_DAYS_BY_TIMEFRAME: Record<DashboardTimeframe, number> = {
    '1Day': 400, // ~1.5 years of daily
    '1Hour': 40, // ~5 weeks (120 hourly bars = ~18 trading days)
    '15Min': 10, // ~10 days (120 × 15min bars ≈ 5 trading days during market hours)
};

// Concurrency limit for FMP batch fetch (avoids 429)
const FETCH_CONCURRENCY = 10;

function bucketedTimestamp(timeframe: DashboardTimeframe, now: Date): string {
    const iso = now.toISOString();
    if (timeframe === '1Day') return iso.slice(0, 10); // YYYY-MM-DD
    if (timeframe === '1Hour') return iso.slice(0, 13); // YYYY-MM-DDTHH
    // 15Min: floor minute to 15-min bucket
    const minutes = now.getUTCMinutes();
    const bucketMin = Math.floor(minutes / 15) * 15;
    const minStr = bucketMin.toString().padStart(2, '0');
    return `${iso.slice(0, 13)}:${minStr}`; // YYYY-MM-DDTHH:MM
}

function cacheKey(timeframe: DashboardTimeframe, now: Date): string {
    return `dashboard:signals:${timeframe}:${bucketedTimestamp(timeframe, now)}`;
}

function fromDate(timeframe: DashboardTimeframe, now: Date): string {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - LOOKBACK_DAYS_BY_TIMEFRAME[timeframe]);
    return d.toISOString();
}

function computeStockResult(
    symbol: string,
    koreanName: string,
    sectorSymbol: string,
    bars: Bar[]
): StockSignalResult | null {
    if (bars.length < 2) return null;
    const last = bars[bars.length - 1];
    const prev = bars[bars.length - 2];
    const indicators = calculateIndicators(bars);
    const signals = detectSignals(bars, indicators);
    if (signals.length === 0) return null;
    const trend = classifyTrend(bars, indicators);
    const changePercent =
        prev.close === 0 ? 0 : ((last.close - prev.close) / prev.close) * 100;
    return {
        symbol,
        koreanName,
        sectorSymbol,
        price: last.close,
        changePercent,
        trend,
        signals,
    };
}

async function fetchInChunks<T, R>(
    items: readonly T[],
    chunkSize: number,
    fetcher: (item: T) => Promise<R>
): Promise<PromiseSettledResult<R>[]> {
    const results: PromiseSettledResult<R>[] = [];
    for (let i = 0; i < items.length; i += chunkSize) {
        const chunk = items.slice(i, i + chunkSize);
        const chunkResults = await Promise.allSettled(chunk.map(fetcher));
        results.push(...chunkResults);
    }
    return results;
}

export async function getSectorSignals(
    timeframe: DashboardTimeframe = '1Day'
): Promise<SectorSignalsResult> {
    const cache = createCacheProvider();
    const now = new Date();
    const key = cacheKey(timeframe, now);

    if (cache !== null) {
        try {
            const cached = await cache.get<SectorSignalsResult>(key);
            if (cached !== null) return cached;
        } catch {
            // Graceful degradation: fall through to provider fetch on cache read failure
        }
    }

    const provider = createMarketDataProvider();
    const fromIso = fromDate(timeframe, now);
    const fetchResults = await fetchInChunks(
        SECTOR_STOCKS,
        FETCH_CONCURRENCY,
        s =>
            provider.getBars({
                symbol: s.symbol,
                timeframe: timeframe as Timeframe,
                from: fromIso,
            })
    );

    // fetchResults[i] is guaranteed defined — SECTOR_STOCKS.length === fetchResults.length
    const stocks = SECTOR_STOCKS.map((stockDef, i) => {
        const r = fetchResults[i]!;
        if (r.status === 'rejected') {
            // Graceful degradation: exclude failing symbol from the result set
            return null;
        }
        return computeStockResult(
            stockDef.symbol,
            stockDef.koreanName,
            stockDef.sectorSymbol,
            r.value
        );
    }).filter((s): s is StockSignalResult => s !== null);

    const payload: SectorSignalsResult = {
        computedAt: now.toISOString(),
        stocks,
    };

    if (cache !== null) {
        try {
            await cache.set(key, payload, TTL_BY_TIMEFRAME[timeframe]);
        } catch {
            // Graceful degradation: return computed payload even if cache write fails
        }
    }

    return payload;
}
