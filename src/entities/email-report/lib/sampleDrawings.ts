import type { Bar, ChartOverlay } from '@y0ngha/siglens-core';
import type { ChartDrawingSource } from '@/entities/analysis/lib/narrowChartDrawings';
import { GUIDE_PATH_BY_SKILL_NAME } from '@/shared/config/guideLinks.generated';
import type { ReportChartDrawings } from '../reportModel';
import { REPORT_CHART_MA_PERIODS } from './chartGeometry';
import { toLegendEntries } from './overlayGeometry';
import { layoutReportChart } from './reportChartLayout';
import {
    buildSampleBars,
    buildSampleChartMa,
    type SampleChartSymbol,
} from './sampleBars';

/** 샘플 상승삼각형 카드의 id. */
const SAMPLE_PATTERN_ID = 'sample-ascending-triangle';
/**
 * 상승삼각형 스킬의 원래 이름(`shared.skillName` 사전의 키). 스킬 frontmatter에서 생성된 가이드 경로 표에서
 * 경로로 찾는다 — 한국어 이름을 소스에 다시 적지 않는다. 표에 없으면 카드 칸을 만들지 않는다.
 */
const SAMPLE_PATTERN_SKILL = Object.entries(GUIDE_PATH_BY_SKILL_NAME).find(
    ([, path]) => path.endsWith('/ascending-triangle')
)?.[0];
/** 샘플 분석이 만들어진 시각 — 샘플 산문의 분석 시각과 같다. */
export const SAMPLE_DRAWINGS_ANALYZED_AT = '2026-10-13T21:00:00Z';

/** 뒤에서 `back`번째 봉(0이 마지막). */
function barFromEnd(bars: readonly Bar[], back: number): Bar {
    const bar = bars.at(-1 - back);
    if (bar === undefined) throw new Error('sample bars are too short');
    return bar;
}

function lowestLow(bars: readonly Bar[], from: number, to: number): Bar {
    return bars
        .slice(from, to)
        .reduce((lowest, bar) => (bar.low < lowest.low ? bar : lowest));
}

function highestHigh(bars: readonly Bar[]): number {
    return Math.max(...bars.map(b => b.high));
}

/**
 * 샘플 차트에 그리는 작도 — 샘플 봉에서 결정적으로 만든다(추세선 하나, 상승삼각형 하나). 실제 메일과 같은
 * 그리기 경로(`layoutReportChart`)를 타도록 저장된 분석의 작도와 같은 모양(`ChartOverlay`)이다.
 */
export function buildSampleDrawings(
    symbol: SampleChartSymbol
): ChartDrawingSource {
    const bars = buildSampleBars(symbol);
    const half = bars.length - 30;
    const firstLow = lowestLow(bars, bars.length - 60, half);
    const secondLow = lowestLow(bars, half, bars.length - 1);
    const rising = secondLow.low >= firstLow.low;
    const trendline: ChartOverlay = {
        id: `tl:${symbol}:sample`,
        kind: 'trendline',
        skill: 'trendline',
        sourceRef: 'trendlines',
        variant: 'primary',
        segments: [
            {
                from: { time: firstLow.time, price: firstLow.low },
                to: { time: secondLow.time, price: secondLow.low },
                role: rising ? 'support' : 'resistance',
                style: 'dashed',
                pane: 'price',
            },
        ],
        levels: [],
        labels: [],
    };

    const window = bars.slice(-40);
    const resistance = highestHigh(window);
    const start = barFromEnd(bars, 35);
    const end = barFromEnd(bars, 3);
    const lowStart = lowestLow(bars, bars.length - 35, bars.length - 20);
    const lowEnd = lowestLow(bars, bars.length - 20, bars.length - 3);
    const triangle: ChartOverlay = {
        id: `pattern:${symbol}:sample`,
        kind: 'pattern',
        skill: 'ascending_triangle',
        sourceRef: SAMPLE_PATTERN_ID,
        variant: 'primary',
        segments: [
            {
                from: { time: start.time, price: resistance },
                to: { time: end.time, price: resistance },
                role: 'boundary_upper',
                style: 'solid',
                pane: 'price',
            },
            {
                from: { time: lowStart.time, price: lowStart.low },
                to: {
                    time: lowEnd.time,
                    price: Math.max(lowEnd.low, lowStart.low),
                },
                role: 'boundary_lower',
                style: 'solid',
                pane: 'price',
            },
        ],
        levels: [{ price: resistance, fromTime: end.time, label: 'breakout' }],
        labels: [],
    };
    return {
        overlays: [trendline, triangle],
        overlayColors: {},
        overlayLabels:
            SAMPLE_PATTERN_SKILL === undefined
                ? {}
                : { [SAMPLE_PATTERN_ID]: SAMPLE_PATTERN_SKILL },
    };
}

/**
 * 샘플 카드의 범례 데이터. 이미지 라우트와 같은 배치(`layoutReportChart`)에서 실제로 그려지는 작도만 담는다.
 * 하나도 못 그리면 `null`이다.
 */
export function buildSampleReportDrawings(
    symbol: SampleChartSymbol
): ReportChartDrawings | null {
    const bars = buildSampleBars(symbol);
    const drawings = buildSampleDrawings(symbol);
    const ma = buildSampleChartMa(bars);
    const layout = layoutReportChart(
        bars,
        Object.fromEntries(
            REPORT_CHART_MA_PERIODS.map(period => [period, ma[period] ?? []])
        ),
        drawings
    );
    if (layout === null || layout.drawn === null) return null;
    return {
        analyzedAt: SAMPLE_DRAWINGS_ANALYZED_AT,
        legend: toLegendEntries(
            layout.drawn.drawnItems,
            drawings.overlayLabels
        ),
    };
}
