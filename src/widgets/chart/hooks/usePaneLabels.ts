'use client';

import type { RefObject } from 'react';
import { useEffect, useRef } from 'react';
import type { IChartApi } from 'lightweight-charts';
import { CHART_COLORS } from '@/shared/lib/chartColors';
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
const SUB_LABEL_DOT = '● ';
/** 범례의 `rounded-sm`과 같은 값. */
const LABEL_RADIUS = '4px';
/**
 * 좌우만 준다. 전역 `box-sizing: border-box` 아래에서 세로 패딩은 아래의
 * `maxHeight` 클램프를 그대로 갉아먹어 라벨을 다시 잘리게 만든다.
 */
const LABEL_PADDING = '0 4px';

/** 라벨 한 줄의 높이(`font-size: 11px` + `line-height: 1`). */
const LABEL_ROW_PX = 11;

/**
 * LWC가 심는 TradingView 귀속 마크. 지우거나 옮기면 안 되는 서드파티 요구사항이라
 * **라벨 쪽이 비켜야** 한다.
 *
 * 좌표는 라이브러리가 인라인 `<style>`로 못박는다(`dist`의
 * `a#tv-attr-logo{left:10px;bottom:10px;height:19px;width:35px}`). 실측 rect를
 * 읽을 수 있으면 그쪽을 쓰고, 못 읽을 때만 이 값들로 되돌아간다.
 */
const ATTRIBUTION_SELECTOR = 'a#tv-attr-logo';
const ATTRIBUTION_LEFT_PX = 10;
const ATTRIBUTION_BOTTOM_PX = 10;
const ATTRIBUTION_WIDTH_PX = 35;
const ATTRIBUTION_HEIGHT_PX = 19;

/** 컨테이너 좌표계에서 본 귀속 마크의 자리. */
interface AttributionBox {
    top: number;
    bottom: number;
    right: number;
}

function attributionBox(container: HTMLElement): AttributionBox | null {
    const logo = container.querySelector(ATTRIBUTION_SELECTOR);
    if (logo === null) return null;

    const logoRect = logo.getBoundingClientRect();
    if (logoRect.height > 0) {
        const containerRect = container.getBoundingClientRect();
        return {
            top: logoRect.top - containerRect.top,
            bottom: logoRect.bottom - containerRect.top,
            right: logoRect.right - containerRect.left,
        };
    }

    // 첫 페인트 전에는 rect가 전부 0이다. 라이브러리가 고정해 둔 값으로 대체한다.
    const bottom = container.clientHeight - ATTRIBUTION_BOTTOM_PX;
    return {
        top: bottom - ATTRIBUTION_HEIGHT_PX,
        bottom,
        right: ATTRIBUTION_LEFT_PX + ATTRIBUTION_WIDTH_PX,
    };
}

/**
 * 라벨의 왼쪽 위치. 귀속 마크와 세로로 겹치면 마크 오른쪽으로 물린다.
 *
 * 가로 판정은 생략한다 — 기본 위치(8px)는 마크의 가로 범위(10~45px) 안으로
 * 반드시 들어가므로 세로가 겹치면 그게 곧 충돌이다. 마지막 보조 pane이
 * 짧아지면(실측 임계 ~43px) 마크가 라벨 위에 얹혀 `● CCI(20)`이 `▓▓I(20)`으로
 * 찍혔고, 보조 pane 6개에서는 `● MFI`가 통째로 가려졌다.
 */
function labelLeftPx(
    container: HTMLElement,
    labelTopPx: number,
    labelHeightPx: number
): number {
    const logo = attributionBox(container);
    if (logo === null) return LABEL_OFFSET_PX;

    const overlaps =
        labelTopPx < logo.bottom && labelTopPx + labelHeightPx > logo.top;
    return overlaps ? logo.right + LABEL_OFFSET_PX : LABEL_OFFSET_PX;
}

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

function createLabelElement(config: PaneLabelConfig): HTMLDivElement {
    const el = document.createElement('div');
    el.className = PANE_LABEL_CLASS;
    el.style.position = 'absolute';
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
    el.style.overflow = 'hidden';
    /*
     * **불투명 배경이 필요하다.** 라벨은 지표선 위에 떠 있어서 배경이 없으면
     * 대비가 선이 지나가는 자리에 따라 무너진다 — 다크 최악 1.13:1(StochRSI
     * `%D`), 라이트 최악 2.93:1이었고 라벨 면적의 5~36%가 4.5:1 아래였다.
     * 선이 라벨까지 닿지 않는 54px 거래량 pane만 12.08:1로 멀쩡했다는 게
     * pane 높이가 악화 요인임을 보여준다. `usePricePaneStretch`가 짧은 보조
     * pane을 정상 상태로 만들었으니 방치하면 더 나빠진다.
     *
     * 값은 차트 배경(`secondary-900`: 다크 #09090b / 라이트 #f7f8fa)과 같은
     * 것으로, `OverlayLegend`의 `bg-secondary-900`이 해결한 것과 같은 처방이다.
     * 알파를 섞지 않는 이유도 같다 — 알파면 뒤에 무엇이 오느냐에 따라 다시 흔들린다.
     *
     * 테마는 생성 시점 값으로 충분하다. 테마가 바뀌면 `ChartContent`가
     * `key={themeVersion}`으로 `StockChart`를 통째로 remount하고, 그러면 이
     * 훅의 effect도 다시 돌아 라벨을 새로 만든다.
     */
    el.style.backgroundColor = CHART_COLORS.background;
    el.style.borderRadius = LABEL_RADIUS;
    el.style.padding = LABEL_PADDING;

    for (const subLabel of config.subLabels) {
        el.appendChild(createSubLabelSpan(subLabel));
    }

    return el;
}

/**
 * pane 기하에 맞춰 라벨을 놓는다. 생성 직후와 pane 재분배 때 **같은 함수**를
 * 쓴다 — 한쪽만 고쳐지는 형태를 만들지 않기 위해서다.
 */
function positionLabel(
    container: HTMLElement,
    el: HTMLDivElement,
    paneTop: number,
    paneHeight: number
): void {
    const top = paneTop + LABEL_OFFSET_PX;
    el.style.top = `${top}px`;
    /* pane이 재분배되면 클램프도 따라가야 한다 — 안 그러면 좁아진 pane에서
       라벨이 다시 아래를 침범한다. */
    el.style.maxHeight = `${Math.max(
        LABEL_MIN_BOX_PX,
        paneHeight - LABEL_OFFSET_PX * 2
    )}px`;
    /* 실측 높이를 쓰되, 아직 레이아웃이 없으면 한 줄로 본다. */
    const labelHeight = el.getBoundingClientRect().height || LABEL_ROW_PX;
    el.style.left = `${labelLeftPx(container, top, labelHeight)}px`;
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
            const el = createLabelElement(config);
            container.appendChild(el);
            positionLabel(
                container,
                el,
                getTopOffset(chart, config.paneIndex),
                paneHeightOf(chart, config.paneIndex)
            );
            return { config, el };
        });

        labelElementsRef.current = labelPairs.map(({ el }) => el);

        const recomputeTops = () => {
            const currentChart = chartRef.current;
            if (!currentChart) return;
            for (const { config, el } of labelPairs) {
                positionLabel(
                    container,
                    el,
                    getTopOffset(currentChart, config.paneIndex),
                    paneHeightOf(currentChart, config.paneIndex)
                );
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
