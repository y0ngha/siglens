/**
 * 추세 차트의 좌표 계산 — 스케일, 막대 배치, 기간별 히트 영역을 순수 함수로 둔다.
 */
import type { SeriesColor, TrendSeries } from './trendChartTypes';

/** SVG viewBox 높이(고정). */
export const SVG_HEIGHT = 120;
/** 막대 영역 바깥 여백. 좌우는 %, 상하는 viewBox 단위다. */
export const SVG_PADDING_TOP = 8;
const SVG_PADDING_BOTTOM = 8;
export const SVG_PADDING_LEFT = 4;
export const SVG_PADDING_RIGHT = 4;
/** 막대를 그릴 수 있는 세로 높이. */
export const CHART_HEIGHT = SVG_HEIGHT - SVG_PADDING_TOP - SVG_PADDING_BOTTOM;

/** viewBox 가로 폭 — 좌표를 퍼센트로 쓰므로 100 고정이다. */
const VIEWBOX_WIDTH = 100;

/** 기간 그룹 폭 중 좌우 각각을 비워 두는 비율. */
const GROUP_PADDING_RATIO = 0.1;

/** 시리즈와 기간 수에서 정해지는 차트 배치. */
export interface TrendLayout {
    /** 기간 하나(막대 묶음)가 차지하는 폭(%). */
    barGroupWidth: number;
    /** 막대 묶음 안쪽 좌우 여백(%). */
    barPadding: number;
    /** 시리즈 막대 하나의 폭(%). */
    singleBarWidth: number;
    /** 0 값 기준선의 y. 음수가 있으면 차트 가운데, 없으면 아래쪽이다. */
    baselineY: number;
    /** 기준선에서 위(또는 아래)로 쓸 수 있는 높이. */
    availableHeight: number;
    /** 모든 값 절대값의 최댓값 — 막대 높이의 분모. */
    maxAbs: number;
}

/** 시리즈 전체에서 값이 있는 것만 평탄화한다. */
function presentValues(series: readonly TrendSeries[]): number[] {
    return series.flatMap(s => s.values.filter((v): v is number => v !== null));
}

/**
 * 시리즈와 기간 수로 차트 배치를 계산한다.
 *
 * `maxAbs`는 `reduce`로 구한다 — `Math.max(...spread)`는 매우 큰 입력에서 호출 스택을 넘긴다.
 * 모든 값이 0이면 분모가 0이 되지 않도록 1로 둔다.
 */
export function computeTrendLayout(
    series: readonly TrendSeries[],
    periodCount: number
): TrendLayout {
    const values = presentValues(series);
    const maxAbs = values.reduce((m, v) => Math.max(m, Math.abs(v)), 0) || 1;
    const hasNegative = values.some(v => v < 0);

    const barGroupWidth =
        (VIEWBOX_WIDTH - (SVG_PADDING_LEFT + SVG_PADDING_RIGHT)) / periodCount;
    const barPadding = barGroupWidth * GROUP_PADDING_RATIO;
    const singleBarWidth = (barGroupWidth - barPadding * 2) / series.length;

    return {
        barGroupWidth,
        barPadding,
        singleBarWidth,
        baselineY: hasNegative
            ? SVG_PADDING_TOP + CHART_HEIGHT / 2
            : SVG_PADDING_TOP + CHART_HEIGHT,
        availableHeight: hasNegative ? CHART_HEIGHT / 2 : CHART_HEIGHT,
        maxAbs,
    };
}

/** 그려질 막대 하나. */
export interface TrendBar {
    key: string;
    periodIdx: number;
    color: SeriesColor | undefined;
    x: string;
    y: number;
    width: string;
    height: number;
}

function barHeight(value: number, layout: TrendLayout): number {
    return (Math.abs(value) / layout.maxAbs) * layout.availableHeight;
}

/**
 * 시리즈의 모든 막대를 배치한다. 값이 없거나 높이가 0인 막대는 그리지 않는다.
 * 양수는 기준선 위로, 음수는 기준선 아래로 자란다 — 부호는 색이 아니라 방향으로 읽힌다.
 */
export function buildTrendBars(
    series: readonly TrendSeries[],
    layout: TrendLayout
): TrendBar[] {
    return series.flatMap((s, seriesIdx) =>
        s.values.flatMap((value, periodIdx) => {
            if (value === null) return [];
            const height = barHeight(value, layout);
            if (height === 0) return [];
            const groupStart =
                SVG_PADDING_LEFT +
                periodIdx * layout.barGroupWidth +
                layout.barPadding;
            return [
                {
                    key: `${seriesIdx}-${periodIdx}`,
                    periodIdx,
                    color: s.color,
                    x: `${groupStart + seriesIdx * layout.singleBarWidth}%`,
                    y:
                        value >= 0
                            ? layout.baselineY - height
                            : layout.baselineY,
                    width: `${layout.singleBarWidth}%`,
                    height,
                },
            ];
        })
    );
}

/** 기간 하나의 호버 영역 x(%) 좌표. */
export function periodHitX(periodIdx: number, layout: TrendLayout): string {
    return `${SVG_PADDING_LEFT + periodIdx * layout.barGroupWidth}%`;
}
