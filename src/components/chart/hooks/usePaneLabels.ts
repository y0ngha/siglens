'use client';

import type { RefObject } from 'react';
import { useEffect, useRef } from 'react';
import type { IChartApi } from 'lightweight-charts';
import type { PaneLabelConfig, PaneSubLabel } from '@/components/chart/types';

interface UsePaneLabelsParams {
    chartRef: RefObject<IChartApi | null>;
    containerRef: RefObject<HTMLDivElement | null>;
    labels: PaneLabelConfig[];
}

const PANE_LABEL_CLASS = 'pane-indicator-label';
const LABEL_OFFSET_PX = 8;
const LABEL_FONT_SIZE = '11px';
const LABEL_Z_INDEX = '5';
const LABEL_FONT_FAMILY = 'monospace';
const LABEL_LINE_HEIGHT = '1';
const SUB_LABEL_GAP = '6px';
const SUB_LABEL_DOT = '\u25CF ';

function getTopOffset(chart: IChartApi, paneIndex: number): number {
    const panes = chart.panes();
    return panes
        .slice(0, paneIndex)
        .reduce((acc, pane) => acc + pane.getHeight(), 0);
}

function createSubLabelSpan(subLabel: PaneSubLabel): HTMLSpanElement {
    const span = document.createElement('span');
    span.style.color = subLabel.color;
    span.textContent = `${SUB_LABEL_DOT}${subLabel.name}`;
    return span;
}

function createLabelElement(
    config: PaneLabelConfig,
    top: number
): HTMLDivElement {
    const el = document.createElement('div');
    el.className = PANE_LABEL_CLASS;
    el.style.position = 'absolute';
    el.style.top = `${top + LABEL_OFFSET_PX}px`;
    el.style.left = `${LABEL_OFFSET_PX}px`;
    el.style.fontSize = LABEL_FONT_SIZE;
    el.style.pointerEvents = 'none';
    el.style.zIndex = LABEL_Z_INDEX;
    el.style.fontFamily = LABEL_FONT_FAMILY;
    el.style.lineHeight = LABEL_LINE_HEIGHT;
    el.style.display = 'flex';
    el.style.flexDirection = 'column';
    el.style.gap = SUB_LABEL_GAP;

    for (const subLabel of config.subLabels) {
        el.appendChild(createSubLabelSpan(subLabel));
    }

    return el;
}

function clearLabelElements(elements: HTMLDivElement[]): void {
    for (const el of elements) {
        el.remove();
    }
}

export function usePaneLabels({
    chartRef,
    containerRef,
    labels,
}: UsePaneLabelsParams): void {
    const labelElementsRef = useRef<HTMLDivElement[]>([]);

    useEffect(() => {
        const container = containerRef.current;
        const chart = chartRef.current;

        clearLabelElements(labelElementsRef.current);
        labelElementsRef.current = [];

        if (!container || !chart || labels.length === 0) return;

        const labelPairs = labels.map(config => {
            const top = getTopOffset(chart, config.paneIndex);
            const el = createLabelElement(config, top);
            container.appendChild(el);
            return { config, el };
        });

        labelElementsRef.current = labelPairs.map(({ el }) => el);

        const recomputeTops = () => {
            const currentChart = chartRef.current;
            if (!currentChart) return;
            for (const { config, el } of labelPairs) {
                const top = getTopOffset(currentChart, config.paneIndex);
                el.style.top = `${top + LABEL_OFFSET_PX}px`;
            }
        };

        // pane 추가/제거 직후에는 LWC가 아직 pane 높이를 갱신하지 않은 상태일 수
        // 있어 effect 동기 실행 시점에 잡은 top 값이 stale하다. 다음 페인트 직전
        // RAF에서 한 번 더 재계산해 정렬을 맞춘다.
        const rafId = requestAnimationFrame(recomputeTops);

        // pane 높이 변화 추적: wrapper container 자체는 pane 재분배 시 크기가
        // 변하지 않으므로 observer가 발화하지 않는다. LWC가 각 pane을 별도
        // canvas로 렌더하므로, container 내부 canvas들을 직접 observe해 pane
        // 높이가 변할 때마다 label top을 재계산한다.
        const observer = new ResizeObserver(recomputeTops);

        observer.observe(container);
        const canvases = container.querySelectorAll('canvas');
        for (const canvas of canvases) {
            observer.observe(canvas);
        }

        return () => {
            cancelAnimationFrame(rafId);
            observer.disconnect();
            clearLabelElements(labelPairs.map(({ el }) => el));
            labelElementsRef.current = [];
        };
    }, [chartRef, containerRef, labels]);
}
