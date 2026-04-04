import type { Trendline } from '@/domain/types';

export function trendlineKey(trendline: Trendline): string {
    return `${trendline.direction}:${trendline.start.time}:${trendline.end.time}`;
}
