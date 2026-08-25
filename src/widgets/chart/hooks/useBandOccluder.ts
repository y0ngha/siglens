'use client';

import { useEffect } from 'react';
import type { ISeriesApi } from 'lightweight-charts';
import { getChartChrome } from '@/shared/lib/chartColors';
import { THEME_CHANGE_EVENT } from '@/shared/lib/theme';

/**
 * 밴드형 오버레이(볼린저·켈트너·돈치안)의 **하단 차폐 시리즈**를 테마에 맞춘다.
 *
 * lightweight-charts의 `AreaSeries`는 자기 선에서 **pane 바닥까지** 채운다 —
 * 다음 시리즈까지가 아니다. 그래서 이 위젯들은 상단 시리즈에 실제 밴드 틴트를
 * 칠하고, 나중에 추가되는(=위에 그려지는) 하단 시리즈를 **차트 배경색으로
 * 불투명하게 채워** 하단 밴드 아래를 덮는 방식으로 띠 모양을 만든다.
 *
 * 즉 하단 시리즈의 채움은 장식이 아니라 **마스크**다. 투명하게 두면 상단 틴트가
 * pane 바닥까지 번진다. 대신 배경색이므로 테마가 바뀌면 함께 갱신해야 하고,
 * 그 갱신을 여기서 담당한다.
 *
 * (근거: `lightweight-charts` 렌더러가 `baseLevelCoordinate ?? mediaSize.height`로
 * 채움 하한을 잡고, `addSeries` 순서대로 z-order가 매겨진다.)
 */
export function useBandOccluder(
    seriesRef: React.RefObject<ISeriesApi<'Area'> | null>
): void {
    useEffect(() => {
        const apply = () => {
            const series = seriesRef.current;
            if (!series) return;
            const background = getChartChrome().background;
            series.applyOptions({
                topColor: background,
                bottomColor: background,
            });
        };
        window.addEventListener(THEME_CHANGE_EVENT, apply);
        return () => window.removeEventListener(THEME_CHANGE_EVENT, apply);
    }, [seriesRef]);
}
