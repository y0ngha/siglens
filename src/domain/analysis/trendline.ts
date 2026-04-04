import type { Trendline, TrendlinePoint } from '@/domain/types';

/**
 * 주어진 추세선을 targetTime까지 선형 외삽한 점을 반환한다.
 * start.time === end.time인 경우(기울기 0 분모) end.price를 그대로 반환한다.
 */
export function extendTrendline(
    trendline: Trendline,
    targetTime: number
): TrendlinePoint {
    const { start, end } = trendline;
    const timeDelta = end.time - start.time;

    if (timeDelta === 0) {
        return { time: targetTime, price: end.price };
    }

    const slope = (end.price - start.price) / timeDelta;
    const price = start.price + slope * (targetTime - start.time);

    return { time: targetTime, price };
}
