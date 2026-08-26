'use client';

import type { RefObject } from 'react';
import { useEffect, useRef } from 'react';
import type { IChartApi } from 'lightweight-charts';
import type { PaneLabelConfig, PaneSubLabel } from '../types';

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
/** 가로 배치일 때 부라벨 사이 간격. 세로 간격보다 넓어야 낱말이 붙어 보이지 않는다. */
const SUB_LABEL_ROW_GAP = '10px';
/** 클램프 하한 — pane이 아무리 얇아도 한 줄은 보여준다. */
const LABEL_MIN_BOX_PX = 12;
const SUB_LABEL_DOT = '\u25CF ';

function paneHeightOf(chart: IChartApi, paneIndex: number): number {
    return chart.panes()[paneIndex]?.getHeight() ?? 0;
}

function getTopOffset(chart: IChartApi, paneIndex: number): number {
    const panes = chart.panes();
    return panes
        .slice(0, paneIndex)
        .reduce((acc, pane) => acc + pane.getHeight(), 0);
}

function createSubLabelSpan(subLabel: PaneSubLabel): HTMLSpanElement {
    const span = document.createElement('span');
    /*
     * 지표 색은 점에만 칠한다. 라벨 텍스트까지 지표 색으로 칠하면 라이트
     * 테마에서 밝은 지표가 2.4~3.3:1로 읽히지 않는다(OverlayLegend와 같은 이유).
     * 텍스트 색은 지정하지 않고 부모의 전경색을 상속받는다.
     */
    const dot = document.createElement('span');
    dot.setAttribute('aria-hidden', 'true');
    dot.style.color = subLabel.color;
    dot.textContent = SUB_LABEL_DOT;
    span.append(dot, subLabel.name);
    return span;
}

function createLabelElement(
    config: PaneLabelConfig,
    top: number,
    paneHeight: number
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
    /*
     * **가로로 늘어놓는다.** 세로 스택이었는데, MACD처럼 부라벨이 3개면
     * 11px × 3 + 간격 6px × 2 = 45px가 되어 36px짜리 보조 pane을 넘고
     * 아래 pane의 라벨과 겹쳐 찍혔다(모바일 500px에서 실측 — `Histogram`과
     * `+DI(14)`가 한 줄에서 충돌). 가로로는 한 줄 11px면 끝난다.
     *
     * 넘칠 때를 대비해 pane 높이로 잘라 둔다. 폭이 모자라면 `wrap`이 다음
     * 줄로 넘기고, 그래도 넘치면 `hidden`이 pane 경계에서 끊는다 — 아래
     * pane을 침범하는 것보다 잘리는 편이 낫다.
     */
    el.style.display = 'flex';
    el.style.flexDirection = 'row';
    el.style.flexWrap = 'wrap';
    el.style.columnGap = SUB_LABEL_ROW_GAP;
    el.style.rowGap = SUB_LABEL_GAP;
    el.style.maxHeight = `${Math.max(LABEL_MIN_BOX_PX, paneHeight - LABEL_OFFSET_PX * 2)}px`;
    el.style.overflow = 'hidden';

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
            const el = createLabelElement(
                config,
                top,
                paneHeightOf(chart, config.paneIndex)
            );
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
                /* pane이 재분배되면 클램프도 따라가야 한다 — 안 그러면
                   좁아진 pane에서 라벨이 다시 아래를 침범한다. */
                el.style.maxHeight = `${Math.max(
                    LABEL_MIN_BOX_PX,
                    paneHeightOf(currentChart, config.paneIndex) -
                        LABEL_OFFSET_PX * 2
                )}px`;
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
