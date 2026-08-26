'use client';

import type { RefObject } from 'react';
import { useEffect } from 'react';
import type { IChartApi } from 'lightweight-charts';
import type { PaneIndices } from '../types';

/**
 * 가격 pane이 보조 pane에 밀려 굶는 것을 막는다.
 *
 * **근거(라이브러리 소스 확인).** lightweight-charts 5.2.0은 pane 높이를 오직
 * stretch factor 비율로만 나눈다 — `ChartWidget._adjustSizeImpl`이
 * `stretchFactor * (전체높이 / stretch합)`을 쓰고 하한은 2px뿐이다.
 * `MIN_PANE_HEIGHT`(30)은 사용자가 구분선을 드래그하는 경로에만 걸린다.
 * 생성 시 가격 pane은 stretch 2, 추가 pane은 1이므로 보조 pane이 N개면
 * 가격 pane의 몫은 2/(2+N)이다 — N=3이면 40%, N=6이면 25%.
 *
 * 246px 차트(모바일)에서 N=3일 때 실측 86px였다. 그 높이에서는 이동평균
 * 7개가 몇 픽셀 안에 겹쳐 사실상 구분되지 않고, 범례는 pane보다 커진다.
 *
 * 그래서 가격 pane의 stretch를 N으로 올려 **최소 절반**을 확보한다:
 * 몫 = N/(N+N) = 50%. N ≤ 2에서는 기본값 2가 더 크므로 기존 배치가
 * 그대로 유지된다(회귀 없음).
 *
 * 사용자가 구분선을 직접 드래그하면 LWC가 stretch factor를 픽셀 높이에서
 * 역산해 덮어쓴다. 이 훅은 pane 개수가 바뀔 때만 실행되므로 그 조작을
 * 되돌리지 않는다.
 */
export const MIN_PRICE_PANE_STRETCH = 2;

export function usePricePaneStretch(
    chartRef: RefObject<IChartApi | null>,
    paneIndices: PaneIndices
): void {
    useEffect(() => {
        const chart = chartRef.current;
        if (!chart) return;

        const panes = chart.panes();
        const pricePane = panes[0];
        if (!pricePane) return;

        const subPaneCount = panes.length - 1;
        pricePane.setStretchFactor(
            Math.max(MIN_PRICE_PANE_STRETCH, subPaneCount)
        );
    }, [chartRef, paneIndices]);
}
