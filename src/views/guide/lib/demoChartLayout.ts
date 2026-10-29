/**
 * 가이드 데모 차트(`GuideDemoChart`)의 배치 계산 — 가격 범위, 패널 틀, 봉 장애물, 오버레이 라벨 자리.
 * 렌더(색 클래스·SVG 요소)는 `ui/`가 맡고 여기는 좌표만 낸다.
 */
import type {
    DemoBar,
    DemoBarTone,
    DemoLineRole,
    DemoOverlay,
    DemoSeriesTone,
    GuideDemo,
} from '@/views/guide/demos/types';
import {
    estimateLabelWidth,
    linearScale,
    niceTicks,
    placeLabel,
    tickStep,
    type ChartPoint,
    type LabelBox,
    type LinearScale,
} from '@/views/guide/lib/chartLayout';

/** viewBox 폭. 모바일(≈330px)에서 0.75배, 데스크톱(최대 36rem)에서 1.3배로 그려진다. */
export const DEMO_CHART_WIDTH = 440;
const MARGIN_LEFT = 6;
const MARGIN_RIGHT = 46;
/** 가격 영역 위 여백. 강조 구간 띠도 여기서 시작한다. */
export const DEMO_CHART_MARGIN_TOP = 14;
/** 마지막 패널(없으면 가격 영역) 아래 여백. 강조 구간 띠 높이도 위·아래 여백을 뺀 값이다(`GuideDemoChart`). */
export const DEMO_CHART_MARGIN_BOTTOM = 8;
/** 가격 영역 높이(viewBox 단위). 보조 패널은 이 아래에 쌓이고, 도형이 패널로 넘치지 않게 clipPath도 이 높이로 자른다. */
export const DEMO_PRICE_HEIGHT = 230;
/** 보조 패널 기본 높이(viewBox 단위). 패널이 `height`를 정하지 않으면 이 값이다. */
export const PANE_HEIGHT = 78;
/** 가격 영역과 첫 패널, 패널과 패널 사이 세로 간격. */
export const PANE_GAP = 8;
/** 라벨 기본 글자 크기(viewBox 단위). 라벨 박스 크기·표식 라벨 간격도 이 값에서 나온다. */
export const DEMO_CHART_FONT = 12;
const BODY_RATIO = 0.62;
const MAX_BODY = 20;
const MIN_BODY = 2;
/** 가격 축 범위를 위아래로 띄우는 비율(범위 대비). 봉·선이 가격 영역 위아래 끝에 붙지 않게 한다. */
export const PRICE_PAD = 0.07;
/** 가격 범위에 넣지 않는 선이 봉 범위에서 이 비율 넘게 떨어지면 범위를 늘리지 않는다. */
const FAR_SERIES_SPAN = 0.35;
/** 표식 화살표의 기준 크기. 밑변 반폭(`MARKER_ARROW_HALF_BASE_RATIO`)과 높이(`MARKER_ARROW_REACH_RATIO`)가 이 값의 배수라 함께 커진다. */
export const DEMO_MARKER_ARROW = 5;
/** 화살표 끝과 봉 끝(고가·저가) 사이 틈 — 화살표가 꼬리에 붙어 꼬리의 일부처럼 보이지 않게 띄운다. */
export const MARKER_BAR_GAP = 3;
/** 화살표 높이(끝 → 밑변) = 기준 크기 × 이 값. 밑변 반폭(`MARKER_ARROW_HALF_BASE_RATIO`)보다 길어야 위·아래를 가리키는 모양으로 읽힌다. */
export const MARKER_ARROW_REACH_RATIO = 1.4;
/** 화살표 밑변 반폭 = 기준 크기 × 이 값(`DemoOverlayShape`). 높이 비율보다 작아 화살표가 뾰족하게 읽힌다. */
export const MARKER_ARROW_HALF_BASE_RATIO = 0.75;
/** 표식 라벨 중심이 화살표 밑변에서 떨어지는 거리(글자 크기 대비). 기본 글자에서 7.8로 박스 반높이(7.5)보다 조금 커, 박스가 밑변에 닿기 직전에 놓인다. */
const MARKER_LABEL_OFFSET_RATIO = 0.65;
/**
 * 라벨 중심을 기준선에서 띄우는 거리. 기본 글자의 라벨 박스 반높이는 7.5라 8이면 박스가 선 바로 위(아래)에 놓인다.
 * 추세선·시리즈 끝 라벨은 선이 더 굵어(1.4·1.5, 구간·띠·수평선은 0.9~1.1) 1 더 띄운다.
 */
const LEVEL_LABEL_OFFSET = 8;
const LINE_END_LABEL_OFFSET = 9;
/** 라벨 박스 높이 = 글자 크기 + 이 값. 위아래 여유가 있어야 이웃 박스와 맞붙어도 글자끼리 닿지 않는다. */
export const LABEL_BOX_PAD_Y = 3;
/** 글자를 박스·구간·가격 영역 가장자리에서 들이는 거리. 가장자리 선과 글자가 겹치지 않게 한다. */
export const LABEL_INSET = 2;
/** 봉 끝에 붙은 표식·라벨이 들어갈 자리(봉 범위 대비 비율). 가격 축 범위를 이만큼 더 넓힌다. */
export const MARKER_ROOM = 0.12;
/**
 * 가격 영역·보조 패널 오른쪽 끝과 축 글자(가격 눈금·패널 눈금·레벨 값) 사이 간격. 두 영역이 같은 오른쪽 끝을
 * 쓰므로 한 값을 읽어야 축 글자가 세로 한 줄로 맞는다(`DemoPriceGrid`, `GuideDemoPane`).
 */
export const DEMO_AXIS_TEXT_GAP = 4;

/** 라벨 글자를 박스의 어느 쪽에 맞추는지(SVG `text-anchor`). */
export type LabelAnchor = 'start' | 'middle' | 'end';

/** 유한한 숫자인지. 데모 시리즈의 빈 칸(`null`)과 계산 불능 값을 함께 거른다. */
export function isFiniteValue(
    value: number | null | undefined
): value is number {
    return value !== null && value !== undefined && Number.isFinite(value);
}

interface DomainCandidate {
    readonly value: number | null | undefined;
    /** false면 봉 범위에서 너무 먼 값은 범위를 넓히지 않는다. */
    readonly strict: boolean;
}

function overlayDomainCandidates(
    overlay: DemoOverlay,
    bars: readonly DemoBar[],
    barSpan: number
): DomainCandidate[] {
    const strict = (value: number | null | undefined): DomainCandidate => ({
        value,
        strict: true,
    });
    switch (overlay.kind) {
        case 'line':
            return [strict(overlay.from.price), strict(overlay.to.price)];
        case 'level':
            return [strict(overlay.price)];
        case 'zone':
            return [strict(overlay.low), strict(overlay.high)];
        case 'series':
            return overlay.values.map(value => ({
                value,
                strict: overlay.includeInDomain === true,
            }));
        case 'band':
            return [...overlay.upper, ...overlay.lower].map(value => ({
                value,
                strict: overlay.includeInDomain === true,
            }));
        case 'profile':
            return overlay.rows.map(row => strict(row.price));
        case 'marker': {
            const bar = bars[overlay.i];
            if (bar === undefined) return [];
            // 표식과 라벨이 들어갈 자리를 남긴다 (봉 끝에 붙은 표식이 잘리거나 라벨이 멀리 밀리지 않게).
            return [
                strict(
                    overlay.position === 'above'
                        ? bar.high + barSpan * MARKER_ROOM
                        : bar.low - barSpan * MARKER_ROOM
                ),
            ];
        }
    }
}

/**
 * 가격 축 범위. 봉 범위에서 시작해 오버레이 값을 그리는 순서대로 넓히고, 위아래로 `PRICE_PAD`만큼 띄운다.
 * 가격 범위에 넣지 않는 선은 **그때까지 넓혀진** 범위에서 봉 범위의 35% 안쪽일 때만 범위를 넓힌다 —
 * 그래서 순서가 결과에 영향을 준다.
 */
export function demoPriceDomain(demo: GuideDemo): [number, number] {
    const barMin = Math.min(...demo.bars.map(bar => bar.low));
    const barMax = Math.max(...demo.bars.map(bar => bar.high));
    const barSpan = barMax - barMin || 1;
    const { min, max } = (demo.overlays ?? [])
        .flatMap(overlay =>
            overlayDomainCandidates(overlay, demo.bars, barSpan)
        )
        .reduce(
            (range, { value, strict }) => {
                if (!isFiniteValue(value)) return range;
                const far =
                    value < range.min - barSpan * FAR_SERIES_SPAN ||
                    value > range.max + barSpan * FAR_SERIES_SPAN;
                if (!strict && far) return range;
                return {
                    min: Math.min(range.min, value),
                    max: Math.max(range.max, value),
                };
            },
            { min: barMin, max: barMax }
        );
    const pad = (max - min || 1) * PRICE_PAD;
    return [min - pad, max + pad];
}

/** 보조 패널 하나의 틀. x축은 가격 차트와 공유한다. */
export interface PaneFrame {
    readonly top: number;
    readonly height: number;
    readonly left: number;
    readonly right: number;
    /** 봉 인덱스 → 칸 가운데 x. 가격 차트와 같은 함수라 패널 막대·선이 봉과 세로로 줄을 맞춘다. */
    readonly xOf: (index: number) => number;
    readonly pitch: number;
    readonly barCount: number;
}

/** 라벨이 벗어나면 안 되는 가격 영역 경계. */
export interface PlotBounds {
    readonly top: number;
    readonly bottom: number;
    readonly left: number;
    readonly right: number;
}

/** 데모 차트 한 장의 좌표계. `demoChartFrame`이 한 번 만들고 도형·라벨·패널이 모두 이 축을 읽어 서로 어긋나지 않는다. */
export interface DemoChartFrame {
    readonly plot: PlotBounds;
    readonly plotWidth: number;
    /** 봉 한 칸의 폭(몸통 + 양옆 간격). 구간·수평선의 좌우 끝을 칸 경계에 맞추는 데 쓴다. */
    readonly pitch: number;
    readonly xOf: (index: number) => number;
    readonly yOf: LinearScale;
    readonly ticks: readonly number[];
    readonly tickStep: number;
    readonly bodyWidth: number;
    readonly panes: readonly PaneFrame[];
    readonly totalHeight: number;
}

/** 데모의 봉 수·패널 수에서 좌표계를 만든다. */
export function demoChartFrame(demo: GuideDemo): DemoChartFrame {
    const barCount = demo.bars.length;
    const plot: PlotBounds = {
        top: DEMO_CHART_MARGIN_TOP,
        bottom: DEMO_CHART_MARGIN_TOP + DEMO_PRICE_HEIGHT,
        left: MARGIN_LEFT,
        right: DEMO_CHART_WIDTH - MARGIN_RIGHT,
    };
    const plotWidth = plot.right - plot.left;
    const pitch = plotWidth / Math.max(1, barCount);
    const xOf = (index: number): number => plot.left + (index + 0.5) * pitch;
    const [min, max] = demoPriceDomain(demo);
    const ticks = niceTicks(min, max, 5);

    const heights = (demo.panes ?? []).map(pane => pane.height ?? PANE_HEIGHT);
    const stack = (list: readonly number[]): number =>
        list.reduce((sum, height) => sum + height + PANE_GAP, 0);
    const panes = heights.map((height, index): PaneFrame => ({
        top: plot.bottom + PANE_GAP + stack(heights.slice(0, index)),
        height,
        left: plot.left,
        right: plot.right,
        xOf,
        pitch,
        barCount,
    }));
    const paneEnd = plot.bottom + PANE_GAP + stack(heights);
    const contentBottom = panes.length > 0 ? paneEnd - PANE_GAP : plot.bottom;

    return {
        plot,
        plotWidth,
        pitch,
        xOf,
        yOf: linearScale(min, max, plot.bottom, plot.top),
        ticks,
        tickStep: tickStep(ticks),
        bodyWidth: Math.min(MAX_BODY, Math.max(MIN_BODY, pitch * BODY_RATIO)),
        panes,
        totalHeight: contentBottom + DEMO_CHART_MARGIN_BOTTOM,
    };
}

/** 봉의 몸통·꼬리가 차지하는 박스 — 라벨이 피해야 하는 고정 장애물이다. */
export function barObstacles(
    bars: readonly DemoBar[],
    frame: Pick<DemoChartFrame, 'xOf' | 'yOf' | 'bodyWidth'>
): LabelBox[] {
    return bars.map((bar, index) => {
        const top = frame.yOf(bar.high);
        return {
            x: frame.xOf(index) - frame.bodyWidth / 2 - 1,
            y: top,
            width: frame.bodyWidth + 2,
            height: Math.max(1, frame.yOf(bar.low) - top),
        };
    });
}

/** 글자 `text`가 기준점 (x, y)에 `anchor`로 붙을 때의 박스. 가격 영역 좌우 밖으로는 나가지 않는다. */
export function labelBoxAt(
    text: string,
    x: number,
    y: number,
    anchor: LabelAnchor,
    plot: PlotBounds,
    size: number = DEMO_CHART_FONT
): LabelBox {
    const width = estimateLabelWidth(text, size);
    const height = size + LABEL_BOX_PAD_Y;
    const leftByAnchor: Readonly<Record<LabelAnchor, number>> = {
        start: x,
        middle: x - width / 2,
        end: x - width,
    };
    return {
        x: Math.min(
            Math.max(leftByAnchor[anchor], plot.left),
            plot.right - width
        ),
        y: y - height / 2,
        width,
        height,
    };
}

/** 박스 안에서 `anchor`에 맞는 글자 기준 x. 좌우 끝은 `LABEL_INSET`만큼 들인다. */
export function labelTextX(box: LabelBox, anchor: LabelAnchor): number {
    const xByAnchor: Readonly<Record<LabelAnchor, number>> = {
        start: box.x + LABEL_INSET,
        middle: box.x + box.width / 2,
        end: box.x + box.width - LABEL_INSET,
    };
    return xByAnchor[anchor];
}

/** 띠 위·아래 값이 둘 다 유한한 칸. 채움 다각형은 이 칸들만 이어 빈 칸에서 띠가 0으로 꺼지지 않는다. */
export interface BandEdge {
    readonly i: number;
    readonly upper: number;
    readonly lower: number;
}

/** 띠(`band`)에서 위·아래 값이 모두 유한한 칸만 남긴다. 두 칸 미만이면 띠를 그리지 않는다. */
export function bandEdges(
    overlay: Extract<DemoOverlay, { kind: 'band' }>
): BandEdge[] {
    return overlay.upper.flatMap((upper, i) => {
        const lower = overlay.lower[i];
        return isFiniteValue(upper) && isFiniteValue(lower)
            ? [{ i, upper, lower }]
            : [];
    });
}

/**
 * 오버레이에 그릴 도형이 있는지. 유효 칸이 2개 미만인 띠와 없는 봉을 가리키는 표식은 도형이 없다 —
 * `DemoOverlayShape`는 이때 감싸는 `<g>`도 내지 않아 빈 그룹이 SVG에 남지 않는다.
 */
export function isOverlayDrawable(
    overlay: DemoOverlay,
    bars: readonly DemoBar[]
): boolean {
    switch (overlay.kind) {
        case 'band':
            return bandEdges(overlay).length >= 2;
        case 'marker':
            return bars[overlay.i] !== undefined;
        case 'zone':
        case 'profile':
        case 'level':
        case 'line':
        case 'series':
            return true;
    }
}

/** 표식 화살표의 끝(봉 쪽)과 밑변 y. 도형과 라벨 자리가 같은 값을 읽어 라벨이 화살표에 맞춰 붙는다. */
export interface MarkerGeometry {
    readonly x: number;
    readonly tipY: number;
    readonly baseY: number;
    readonly above: boolean;
}

/** 표식이 가리키는 봉이 없으면 null. */
export function markerGeometry(
    overlay: Extract<DemoOverlay, { kind: 'marker' }>,
    bars: readonly DemoBar[],
    frame: Pick<DemoChartFrame, 'xOf' | 'yOf'>
): MarkerGeometry | null {
    const bar = bars[overlay.i];
    if (bar === undefined) return null;
    const above = overlay.position === 'above';
    const tipY = above
        ? frame.yOf(bar.high) - MARKER_BAR_GAP
        : frame.yOf(bar.low) + MARKER_BAR_GAP;
    const reach = DEMO_MARKER_ARROW * MARKER_ARROW_REACH_RATIO;
    return {
        x: frame.xOf(overlay.i),
        tipY,
        baseY: above ? tipY - reach : tipY + reach,
        above,
    };
}

/** 이웃한 가격대 막대 사이에 남기는 틈(viewBox 단위) — 막대가 맞붙어 한 덩어리로 보이지 않게 한다. */
const PROFILE_ROW_GAP = 1;
/** 가격대가 촘촘해도 막대가 이 높이 아래로 얇아져 사라지지 않게 하는 하한. */
const PROFILE_ROW_MIN_HEIGHT = 2;
/** 가격대가 하나뿐이면 잴 이웃 간격이 없어 이 높이로 그린다. */
const PROFILE_ROW_FALLBACK_HEIGHT = 4;

/** 가격대별 거래량 막대 한 줄의 높이 — 가장 가까운 두 가격 간격에서 `PROFILE_ROW_GAP`을 뺀다. */
export function profileRowHeight(
    rows: readonly { readonly price: number }[],
    yOf: LinearScale
): number {
    const prices = rows.map(row => row.price).toSorted((a, b) => a - b);
    const gap = prices
        .slice(1)
        .reduce((min, price, i) => Math.min(min, price - prices[i]), Infinity);
    return Number.isFinite(gap)
        ? Math.max(
              PROFILE_ROW_MIN_HEIGHT,
              Math.abs(yOf(0) - yOf(gap)) - PROFILE_ROW_GAP
          )
        : PROFILE_ROW_FALLBACK_HEIGHT;
}

/** 라벨 글자색을 고르는 근거. 색 클래스는 `ui/guideChartStyles`가 고른다. */
export type OverlayLabelColour =
    | { readonly palette: 'zone' }
    | { readonly palette: 'series'; readonly tone: DemoSeriesTone }
    | { readonly palette: 'role'; readonly role: DemoLineRole }
    | { readonly palette: 'bar'; readonly tone: DemoBarTone };

/** `layoutOverlayLabels`가 자리를 정한 라벨 하나. `DemoTextLabel`은 계산 없이 이 값대로 그린다. */
export interface OverlayLabel {
    readonly key: string;
    readonly text: string;
    readonly anchor: LabelAnchor;
    readonly box: LabelBox;
    readonly colour: OverlayLabelColour;
}

interface LabelRequest {
    readonly text: string;
    readonly x: number;
    readonly y: number;
    readonly anchor: LabelAnchor;
    /** -1 위, +1 아래로 비켜 가는 쪽을 선호한다. */
    readonly direction: -1 | 1;
    readonly colour: OverlayLabelColour;
}

/** 오버레이 키 — 종류+위치. 정적 데모 목록이라 재정렬이 없다. 도형과 라벨이 같은 키를 쓴다. */
export function overlayKey(overlay: DemoOverlay, index: number): string {
    return `${overlay.kind}-${index}`;
}

/** 키를 붙인 오버레이. 층을 나눈 뒤에도 키는 원래 목록의 위치에서 나온다. */
export interface KeyedOverlay {
    readonly key: string;
    readonly overlay: DemoOverlay;
}

/** 봉을 사이에 둔 두 층의 오버레이. */
export interface OverlayLayers {
    /** 봉보다 먼저(아래에) 그리는 도형 — 표식이 아닌 모든 오버레이. */
    readonly belowBars: readonly KeyedOverlay[];
    /** 봉 위에 그리는 표식 — 봉 뒤에 깔리면 가려진다. */
    readonly aboveBars: readonly KeyedOverlay[];
}

/** 오버레이를 봉 아래·위 두 층으로 한 번에 나눈다. 각 층 안의 순서는 원래 순서 그대로다. */
export function overlayLayers(overlays: readonly DemoOverlay[]): OverlayLayers {
    const keyed = overlays.map((overlay, index): KeyedOverlay => ({
        key: overlayKey(overlay, index),
        overlay,
    }));
    return {
        belowBars: keyed.filter(({ overlay }) => overlay.kind !== 'marker'),
        aboveBars: keyed.filter(({ overlay }) => overlay.kind === 'marker'),
    };
}

function lastFiniteIndex(values: readonly (number | null)[]): number {
    return values.reduce<number>(
        (last, value, i) => (isFiniteValue(value) ? i : last),
        -1
    );
}

/**
 * 선 끝 라벨이 붙는 점 — `splitRuns`가 낼 마지막 구간의 마지막 점과 같다. 구간을 다시 나누지 않고
 * 마지막 유효 칸만 찾는다: 도형(`SeriesShape`)이 이미 같은 구간을 나누므로 라벨 쪽은 끝점 하나면 된다.
 */
function lastSeriesPoint(
    values: readonly (number | null)[],
    frame: Pick<DemoChartFrame, 'xOf' | 'yOf'>
): ChartPoint | undefined {
    const index = lastFiniteIndex(values);
    const value = values[index];
    return isFiniteValue(value)
        ? { x: frame.xOf(index), y: frame.yOf(value) }
        : undefined;
}

function labelRequest(
    overlay: DemoOverlay,
    bars: readonly DemoBar[],
    frame: DemoChartFrame
): LabelRequest | null {
    const { xOf, yOf, pitch, plot } = frame;
    switch (overlay.kind) {
        case 'zone':
            return overlay.label === undefined
                ? null
                : {
                      text: overlay.label,
                      x: xOf(overlay.fromIndex) - pitch / 2 + LABEL_INSET,
                      y: yOf(overlay.high) + LEVEL_LABEL_OFFSET,
                      anchor: 'start',
                      direction: 1,
                      colour: { palette: 'zone' },
                  };
        case 'band': {
            // 띠를 못 그리면(유효 칸 2개 미만) 라벨도 없다.
            if (bandEdges(overlay).length < 2 || overlay.label === '')
                return null;
            const upperIdx = lastFiniteIndex(overlay.upper);
            const upperValue = overlay.upper[upperIdx];
            return isFiniteValue(upperValue)
                ? {
                      text: overlay.label,
                      x: xOf(upperIdx),
                      y: yOf(upperValue) - LEVEL_LABEL_OFFSET,
                      anchor: 'end',
                      direction: -1,
                      colour: { palette: 'series', tone: overlay.tone ?? 'a' },
                  }
                : null;
        }
        case 'profile':
            return null;
        case 'level':
            return {
                text: overlay.label,
                x: plot.right - LABEL_INSET,
                y: yOf(overlay.price) - LEVEL_LABEL_OFFSET,
                anchor: 'end',
                direction: -1,
                colour: { palette: 'role', role: overlay.role ?? 'neutral' },
            };
        case 'line':
            return overlay.label === undefined
                ? null
                : {
                      text: overlay.label,
                      x: xOf(overlay.to.i),
                      y: yOf(overlay.to.price) - LINE_END_LABEL_OFFSET,
                      anchor: 'end',
                      direction: -1,
                      colour: { palette: 'role', role: overlay.role },
                  };
        case 'series': {
            const last = lastSeriesPoint(overlay.values, frame);
            const visible =
                last !== undefined &&
                last.y >= plot.top &&
                last.y <= plot.bottom;
            return overlay.label === '' || !visible
                ? null
                : {
                      text: overlay.label,
                      x: last.x,
                      y: last.y - LINE_END_LABEL_OFFSET,
                      anchor: 'end',
                      direction: -1,
                      colour: { palette: 'series', tone: overlay.tone ?? 'a' },
                  };
        }
        case 'marker': {
            const marker = markerGeometry(overlay, bars, frame);
            if (marker === null) return null;
            const offset = DEMO_CHART_FONT * MARKER_LABEL_OFFSET_RATIO;
            return {
                text: overlay.label,
                x: marker.x,
                y: marker.above ? marker.baseY - offset : marker.baseY + offset,
                anchor: 'middle',
                direction: marker.above ? -1 : 1,
                colour: { palette: 'bar', tone: overlay.tone },
            };
        }
    }
}

/**
 * 오버레이 라벨의 자리를 오버레이 순서대로 정한다. 앞서 놓인 라벨과 봉을 피하므로(`placeLabel`)
 * 순서가 결과를 바꾼다 — 앞 라벨이 먼저 제자리를 차지한다.
 */
export function layoutOverlayLabels(
    demo: GuideDemo,
    frame: DemoChartFrame
): OverlayLabel[] {
    const obstacles = barObstacles(demo.bars, frame);
    return (demo.overlays ?? []).reduce<OverlayLabel[]>(
        (labels, overlay, index) => {
            const request = labelRequest(overlay, demo.bars, frame);
            if (request === null) return labels;
            const box = placeLabel(
                labels.map(label => label.box),
                labelBoxAt(
                    request.text,
                    request.x,
                    request.y,
                    request.anchor,
                    frame.plot
                ),
                request.direction,
                frame.plot,
                obstacles
            );
            return [
                ...labels,
                {
                    key: overlayKey(overlay, index),
                    text: request.text,
                    anchor: request.anchor,
                    box,
                    colour: request.colour,
                },
            ];
        },
        []
    );
}
