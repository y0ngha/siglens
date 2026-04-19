import type { Bar } from '@/domain/types';
import type {
    SectorSignalsResult,
    StockSignalResult,
} from '@/domain/signals/types';
import { SECTOR_STOCKS } from '@/domain/constants/dashboard-tickers';
import { calculateIndicators } from '@/domain/indicators';
import { classifyTrend, detectSignals } from '@/domain/signals';
import { createCacheProvider } from '@/infrastructure/cache/redis';
import { createMarketDataProvider } from '@/infrastructure/market/factory';

// 1 hour. Intentionally independent from `ANALYSIS_CACHE_TTL` constants —
// daily bars change once per day, so hourly TTL matches the data cadence.
const CACHE_TTL_SECONDS = 3600;
const BARS_LOOKBACK_DAYS = 400;

function cacheKey(): string {
    const date = new Date().toISOString().slice(0, 10);
    return `dashboard:signals:1Day:${date}`;
}

function fromDate(): string {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - BARS_LOOKBACK_DAYS);
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

export async function getSectorSignals(): Promise<SectorSignalsResult> {
    const cache = createCacheProvider();
    const key = cacheKey();

    if (cache !== null) {
        try {
            const cached = await cache.get<SectorSignalsResult>(key);
            if (cached !== null) {
                return cached;
            }
        } catch (err) {
            console.warn('[sectorSignalsApi] cache read failed:', err);
        }
    }

    const provider = createMarketDataProvider();
    const fetchResults = await Promise.allSettled(
        SECTOR_STOCKS.map(s =>
            provider.getBars({
                symbol: s.symbol,
                timeframe: '1Day',
                from: fromDate(),
            })
        )
    );

    const stocks: StockSignalResult[] = [];
    for (let i = 0; i < SECTOR_STOCKS.length; i++) {
        const stockDef = SECTOR_STOCKS[i];
        const r = fetchResults[i];
        if (r.status === 'rejected') {
            console.warn(
                '[sectorSignalsApi] fetch failed for',
                stockDef.symbol,
                r.reason
            );
            continue;
        }
        const result = computeStockResult(
            stockDef.symbol,
            stockDef.koreanName,
            stockDef.sectorSymbol,
            r.value
        );
        if (result !== null) stocks.push(result);
    }

    const payload: SectorSignalsResult = {
        computedAt: new Date().toISOString(),
        stocks,
    };

    if (cache !== null) {
        try {
            await cache.set(key, payload, CACHE_TTL_SECONDS);
        } catch (err) {
            console.warn('[sectorSignalsApi] cache write failed:', err);
        }
    }

    return payload;
}
