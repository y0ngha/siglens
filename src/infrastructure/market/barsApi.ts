import { cacheLife, cacheTag } from 'next/cache';
import { calculateIndicators } from '@/domain/indicators';
import type { BarsData, Timeframe } from '@/domain/types';
import {
    TIMEFRAME_BARS_LIMIT,
    TIMEFRAME_LOOKBACK_DAYS,
} from '@/domain/constants/market';
import { createMarketDataProvider } from '@/infrastructure/market/factory';

function computeFromDay(timeframe: Timeframe, now: Date): string {
    const lookbackDays = TIMEFRAME_LOOKBACK_DAYS[timeframe];
    const from = new Date(now);
    from.setUTCDate(from.getUTCDate() - lookbackDays);
    // UTC 날짜 단위로 절삭하여 캐시 키 안정화 (하루 내 동일 값 보장), RFC3339 형식으로 Alpaca 호환성 확보
    return from.toISOString().substring(0, 10) + 'T00:00:00Z';
}

// new Date()는 'use cache' 경계 바깥에서 계산하여 동적 값이 캐시 키에 포함되도록 한다.
async function fetchBarsWithIndicatorsCached(
    fmpSymbol: string,
    timeframe: Timeframe,
    fromDay: string
): Promise<BarsData> {
    'use cache';
    cacheLife('minutes');
    cacheTag(`bars:${fmpSymbol}:${timeframe}`);

    const limit = TIMEFRAME_BARS_LIMIT[timeframe];
    const provider = createMarketDataProvider();
    const bars = await provider.getBars({
        symbol: fmpSymbol,
        timeframe,
        limit,
        from: fromDay,
    });

    const indicators = calculateIndicators(bars);
    return { bars, indicators };
}

export async function fetchBarsWithIndicators(
    symbol: string,
    timeframe: Timeframe,
    fmpSymbol?: string
): Promise<BarsData> {
    const fromDay = computeFromDay(timeframe, new Date());
    return fetchBarsWithIndicatorsCached(
        fmpSymbol ?? symbol,
        timeframe,
        fromDay
    );
}
