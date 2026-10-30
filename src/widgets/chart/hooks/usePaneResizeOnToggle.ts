'use client';

/**
 * 보조 패인이 늘거나 줄면 가격 차트의 레이아웃을 강제로 다시 잡는 훅 — 사용자가 보던 시간
 * 범위는 지킨다.
 */
import { type RefObject, useEffect, useRef } from 'react';
import type { IChartApi } from 'lightweight-charts';
import type { PaneIndices } from '../types';
import {
    restoreVisibleView,
    snapshotVisibleView,
} from '../utils/visibleViewSnapshot';

/**
 * 지표 제거 시 LWC v5가 빈 pane DOM을 정리하지 않아 autoSize 토글로 layout invalidate를 강제한다.
 *
 * 첫 mount에서는 skip한다 — hydration·첫 진입 시 layout 안정화 전에 wrapper.clientHeight를 재면
 * 작은 값(예: 30px)이 그대로 박혀 viewport 잔여 크기를 무시한 작은 차트로 그려진다. 첫 mount의
 * sizing은 createChart의 autoSize ResizeObserver에 맡기고, 사용자 지표 토글로 paneIndices가
 * 실제로 바뀐 뒤부터만 명시 resize를 부른다.
 *
 * 리사이즈 전후로 보이는 범위를 찍어 되돌린다 — 예전엔 `fitContent()`로 끝내 지표 하나를 켤
 * 때마다 사용자의 줌·스크롤이 전체 범위로 튀었다.
 */
export function usePaneResizeOnToggle(
    chartRef: RefObject<IChartApi | null>,
    wrapperRef: RefObject<HTMLDivElement | null>,
    paneIndices: PaneIndices
): void {
    const isInitialRenderRef = useRef(true);

    useEffect(() => {
        if (isInitialRenderRef.current) {
            isInitialRenderRef.current = false;
            return;
        }
        if (!chartRef.current || !wrapperRef.current) return;

        const rafId = requestAnimationFrame(() => {
            const chart = chartRef.current;
            const wrapper = wrapperRef.current;
            if (!chart || !wrapper) return;

            const { clientWidth, clientHeight } = wrapper;
            if (clientWidth === 0 || clientHeight === 0) return;

            const view = snapshotVisibleView(chart.timeScale());
            chart.applyOptions({ autoSize: false });
            chart.resize(clientWidth - 1, clientHeight);
            chart.resize(clientWidth, clientHeight);
            chart.applyOptions({ autoSize: true });
            if (view === null || !restoreVisibleView(chart.timeScale(), view))
                chart.timeScale().fitContent();
        });

        return () => cancelAnimationFrame(rafId);
    }, [chartRef, wrapperRef, paneIndices]);
}
