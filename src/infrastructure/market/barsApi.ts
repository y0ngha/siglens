import { calculateIndicators } from '@/domain/indicators';
import type { BarsData, BarsResponse, Timeframe } from '@/domain/types';
import { TIMEFRAME_BARS_LIMIT } from '@/domain/constants/market';

export async function fetchBarsWithIndicators(
    symbol: string,
    timeframe: Timeframe,
    signal?: AbortSignal
): Promise<BarsData> {
    const limit = TIMEFRAME_BARS_LIMIT[timeframe];
    const res = await fetch(
        `/api/bars?symbol=${encodeURIComponent(symbol)}&timeframe=${timeframe}&limit=${limit}`,
        { signal }
    );
    if (!res.ok) {
        throw new Error(`데이터를 불러오지 못했습니다 (${res.status})`);
    }
    const data: BarsResponse = await res.json();
    const bars = data.bars;
    const indicators = calculateIndicators(bars);
    return { bars, indicators };
}
