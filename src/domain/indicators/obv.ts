import type { Bar } from '@/domain/types';

export function calculateOBV(bars: Bar[]): number[] {
    if (bars.length === 0) return [];

    // OBV 첫 봉은 0으로 초기화 (TradingView 등 표준 관례). 첫 봉은 이전 종가가
    // 없어 방향성을 판정할 수 없으므로 누적 합산의 기준점 0을 사용한다.
    const results: number[] = new Array(bars.length);
    results[0] = 0;
    for (let i = 1; i < bars.length; i++) {
        const bar = bars[i];
        const prev = results[i - 1];
        const prevClose = bars[i - 1].close;
        results[i] =
            bar.close > prevClose
                ? prev + bar.volume
                : bar.close < prevClose
                  ? prev - bar.volume
                  : prev;
    }
    return results;
}
