'use client';

import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';
import type { IChartApi } from 'lightweight-charts';
import { CHART_COLORS } from '@/domain/constants/colors';

interface PaneLabelConfig {
    paneIndex: number;
    text: string;
}

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

function getTopOffset(chart: IChartApi, paneIndex: number): number {
    const panes = chart.panes();
    return panes
        .slice(0, paneIndex)
        .reduce((acc, pane) => acc + pane.getHeight(), 0);
}

function createLabelElement(text: string, top: number): HTMLDivElement {
    const el = document.createElement('div');
    el.className = PANE_LABEL_CLASS;
    el.textContent = text;
    el.style.position = 'absolute';
    el.style.top = `${top + LABEL_OFFSET_PX}px`;
    el.style.left = `${LABEL_OFFSET_PX}px`;
    el.style.fontSize = LABEL_FONT_SIZE;
    el.style.color = CHART_COLORS.neutral;
    el.style.pointerEvents = 'none';
    el.style.zIndex = LABEL_Z_INDEX;
    el.style.fontFamily = LABEL_FONT_FAMILY;
    el.style.lineHeight = LABEL_LINE_HEIGHT;
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
            const el = createLabelElement(config.text, top);
            container.appendChild(el);
            return { config, el };
        });

        labelElementsRef.current = labelPairs.map(({ el }) => el);

        const observer = new ResizeObserver(() => {
            for (const { config, el } of labelPairs) {
                const top = getTopOffset(chart, config.paneIndex);
                el.style.top = `${top + LABEL_OFFSET_PX}px`;
            }
        });

        observer.observe(container);

        return () => {
            observer.disconnect();
            clearLabelElements(labelPairs.map(({ el }) => el));
            labelElementsRef.current = [];
        };
    }, [chartRef, containerRef, labels]);
}
