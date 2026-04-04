import type { Trendline } from '@/domain/types';
import { CHART_COLORS } from '@/lib/chartColors';

export const TRENDLINE_DIRECTION_LABEL: Record<Trendline['direction'], string> =
    {
        ascending: '상승 추세선',
        descending: '하락 추세선',
    };

export const TRENDLINE_DIRECTION_COLOR: Record<Trendline['direction'], string> =
    {
        ascending: CHART_COLORS.trendlineAscending,
        descending: CHART_COLORS.trendlineDescending,
    };
