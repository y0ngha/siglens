import type { Bar } from '@/domain/types';

export function calculateOBV(bars: Bar[]): number[] {
    if (bars.length === 0) return [];

    // OBV 첫 봉은 0으로 초기화 (TradingView 등 표준 관례). 첫 봉은 이전 종가가
    // 없어 방향성을 판정할 수 없으므로 누적 합산의 기준점 0을 사용한다.
    return bars.reduce<number[]>((acc, bar, i) => {
        if (i === 0) return [0];
        const prev = acc[acc.length - 1];
        const prevClose = bars[i - 1].close;
        if (bar.close > prevClose) return [...acc, prev + bar.volume];
        if (bar.close < prevClose) return [...acc, prev - bar.volume];
        return [...acc, prev];
    }, []);
}
