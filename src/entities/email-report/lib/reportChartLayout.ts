import type { Bar } from '@y0ngha/siglens-core';
import type { ChartDrawingSource } from '@/entities/analysis/lib/narrowChartDrawings';
import { computeChartGeometry, type ChartGeometry } from './chartGeometry';
import {
    computeOverlayGeometry,
    planDrawingWindow,
    type OverlayGeometry,
} from './overlayGeometry';

/** 메일 본문 폭 600px의 2배 — 레티나에서 흐리지 않게 한다. */
export const REPORT_CHART_WIDTH = 1200;
export const REPORT_CHART_HEIGHT = 600;
export const REPORT_CHART_HEADER_HEIGHT = 120;
export const REPORT_CHART_PLOT_HEIGHT =
    REPORT_CHART_HEIGHT - REPORT_CHART_HEADER_HEIGHT;
export const REPORT_CHART_PLOT_PADDING = 24;
/** 수평 레벨 가격표가 차지하는 오른쪽 여백. 작도가 그려질 때만 plot 폭을 줄인다. */
export const REPORT_CHART_GUTTER_WIDTH = 150;

/** 이미지 한 장의 좌표 — 렌더러와 범례 계산(발송 배치)이 같은 결과를 본다. */
export interface ReportChartLayout {
    geo: ChartGeometry;
    /** 캔들·작도가 그려지는 영역의 폭. 작도가 없으면 이미지 전체 폭이다. */
    plotWidth: number;
    /** 그려지는 작도. 없으면(또는 하나도 못 그리면) `null`이고 이미지는 캔들·이동평균뿐이다. */
    drawn: OverlayGeometry | null;
}

/**
 * 봉·이동평균·(있으면) 분석 작도로 이미지 좌표를 정한다. 작도를 하나도 못 그리면(시각이 창에 안 맞음·가격이 축
 * 밖) 작도 없는 이전 이미지와 같은 배치(전체 폭, 60봉)로 돌아간다. 봉이 없으면 `null`.
 */
export function layoutReportChart(
    bars: readonly Bar[],
    ma: Readonly<Record<number, readonly (number | null)[]>>,
    drawings: ChartDrawingSource | null
): ReportChartLayout | null {
    if (drawings !== null) {
        const plan = planDrawingWindow(bars, drawings.overlays);
        const plotWidth = REPORT_CHART_WIDTH - REPORT_CHART_GUTTER_WIDTH;
        const geo =
            plan.overlays.length === 0
                ? null
                : computeChartGeometry(
                      bars,
                      ma,
                      {
                          width: plotWidth,
                          height: REPORT_CHART_PLOT_HEIGHT,
                          padding: REPORT_CHART_PLOT_PADDING,
                      },
                      plan.windowSize
                  );
        if (geo !== null) {
            const drawn = computeOverlayGeometry({
                bars,
                geo,
                plotWidth,
                overlays: plan.overlays,
                drawings,
            });
            if (drawn.lines.length > 0) return { geo, plotWidth, drawn };
        }
    }
    const geo = computeChartGeometry(bars, ma, {
        width: REPORT_CHART_WIDTH,
        height: REPORT_CHART_PLOT_HEIGHT,
        padding: REPORT_CHART_PLOT_PADDING,
    });
    return geo === null
        ? null
        : { geo, plotWidth: REPORT_CHART_WIDTH, drawn: null };
}
