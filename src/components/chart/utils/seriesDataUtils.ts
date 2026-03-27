import type { Bar } from '@/domain/types';
import type { UTCTimestamp } from 'lightweight-charts';

/**
 * bars와 indicator 배열을 lightweight-charts용 시리즈 데이터로 변환한다.
 * null/undefined 값은 WhitespaceData({ time }) 형태로, 유효한 값은
 * SingleValueData({ time, value }) 형태로 반환한다.
 */
export function buildSeriesData<T>(
    bars: Bar[],
    indicatorData: T[],
    key: keyof T
): ({ time: UTCTimestamp; value: number } | { time: UTCTimestamp })[] {
    const count = Math.min(bars.length, indicatorData.length);
    return bars.slice(0, count).map((bar, i) => {
        const value = indicatorData[i]?.[key] as number | null | undefined;
        return value !== null && value !== undefined
            ? { time: bar.time as UTCTimestamp, value }
            : { time: bar.time as UTCTimestamp };
    });
}
