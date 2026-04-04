import type { Trendline } from '@/domain/types';
import { CHART_COLORS } from '@/domain/constants/colors';

export const DEFAULT_LINE_WIDTH = 1;
export const INACTIVE_PANE_INDEX = -1;

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
