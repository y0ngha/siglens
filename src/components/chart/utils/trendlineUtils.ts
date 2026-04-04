import type { Bar, Trendline, TrendlineDirection } from '@/domain/types';

export function trendlineKey(trendline: Trendline): string {
    return `${trendline.direction}:${trendline.start.time}:${trendline.end.time}`;
}

/**
 * 추세선의 기준 가격을 실제 바 데이터에서 조회한다.
 * 상승 추세선은 저가(low), 하락 추세선은 고가(high)를 사용한다.
 * 해당 타임스탬프의 바가 없으면 AI가 제공한 가격을 그대로 사용한다.
 */
export function resolveTrendlinePrice(
    bar: Bar | undefined,
    direction: TrendlineDirection,
    fallback: number
): number {
    if (!bar) return fallback;
    return direction === 'ascending' ? bar.low : bar.high;
}
