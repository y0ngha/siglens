import type { TrendlineDirection } from '@y0ngha/siglens-core';
import { CHART_COLORS } from '@/shared/lib/chartColors';

export const TRENDLINE_DIRECTION_LABEL: Record<TrendlineDirection, string> = {
    ascending: '상승 추세선',
    descending: '하락 추세선',
};

/**
 * 추세선 색. **상수 맵이 아니라 함수다** — `CHART_COLORS`는 접근 시점에
 * 테마를 보는 게터라, 모듈 로드 때 한 번 읽어 객체에 담으면 그 값이 다크로
 * 굳고 라이트에서 이 색만 조용히 옛 값으로 남는다.
 */
export function trendlineDirectionColor(direction: TrendlineDirection): string {
    return direction === 'ascending'
        ? CHART_COLORS.trendlineAscending
        : CHART_COLORS.trendlineDescending;
}
