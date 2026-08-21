import type { TrendlineDirection } from '@y0ngha/siglens-core';
import { CHART_COLORS } from '@/shared/lib/chartColors';

/**
 * 표시 문자열이 아니라 `shared.lib.trendline` 네임스페이스의 **키**다.
 * 소비 컴포넌트가 `t(TRENDLINE_DIRECTION_LABEL_KEY[dir])`로 해석한다.
 */
export const TRENDLINE_DIRECTION_LABEL_KEY: Record<TrendlineDirection, string> =
    {
        ascending: 'ascending',
        descending: 'descending',
    };

export const TRENDLINE_DIRECTION_COLOR: Record<TrendlineDirection, string> = {
    ascending: CHART_COLORS.trendlineAscending,
    descending: CHART_COLORS.trendlineDescending,
};
