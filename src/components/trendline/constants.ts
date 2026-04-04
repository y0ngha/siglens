import type { TrendlineDirection } from '@/domain/types';
import { CHART_COLORS } from '@/lib/chartColors';

export const TRENDLINE_DIRECTION_LABEL: Record<TrendlineDirection, string> = {
    ascending: '상승 추세선',
    descending: '하락 추세선',
};

export const TRENDLINE_DIRECTION_COLOR: Record<TrendlineDirection, string> = {
    ascending: CHART_COLORS.trendlineAscending,
    descending: CHART_COLORS.trendlineDescending,
};
