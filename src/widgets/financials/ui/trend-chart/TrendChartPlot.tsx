/**
 * 추세 차트의 SVG 본체 — 기준선, 막대, 기간별 포인터 히트 영역.
 */
import type { PointerEvent } from 'react';
import {
    CHART_HEIGHT,
    SVG_HEIGHT,
    SVG_PADDING_LEFT,
    SVG_PADDING_RIGHT,
    SVG_PADDING_TOP,
    periodHitX,
    type TrendBar,
    type TrendLayout,
} from '../../utils/trendChartGeometry';
import { TrendBars } from './TrendBars';

/** 기준선 두께. */
const BASELINE_STROKE_WIDTH = '0.5';

interface TrendChartPlotProps {
    periods: string[];
    layout: TrendLayout;
    bars: TrendBar[];
    activePeriodIdx: number | null;
    onPointer: (periodIdx: number, event: PointerEvent) => void;
    onLeave: () => void;
}

/**
 * 막대 차트 SVG. 스크린리더에는 숨기고(`aria-hidden`) 같은 수치를 아래 StatementTable이 준다 —
 * 호버 판독은 마우스 전용 점진적 향상이다.
 */
export function TrendChartPlot({
    periods,
    layout,
    bars,
    activePeriodIdx,
    onPointer,
    onLeave,
}: TrendChartPlotProps) {
    return (
        <svg
            width="100%"
            height={SVG_HEIGHT}
            aria-hidden="true"
            role="presentation"
            className="overflow-visible"
            viewBox={`0 0 100 ${SVG_HEIGHT}`}
            preserveAspectRatio="none"
        >
            <line
                x1={`${SVG_PADDING_LEFT}%`}
                y1={layout.baselineY}
                x2={`${100 - SVG_PADDING_RIGHT}%`}
                y2={layout.baselineY}
                className="stroke-secondary-700"
                strokeWidth={BASELINE_STROKE_WIDTH}
            />
            <TrendBars bars={bars} activePeriodIdx={activePeriodIdx} />
            {periods.map((period, periodIdx) => (
                <rect
                    key={`hit-${period}`}
                    x={periodHitX(periodIdx, layout)}
                    y={SVG_PADDING_TOP}
                    width={`${layout.barGroupWidth}%`}
                    height={CHART_HEIGHT}
                    fill="transparent"
                    className="cursor-crosshair"
                    onPointerEnter={e => onPointer(periodIdx, e)}
                    onPointerMove={e => onPointer(periodIdx, e)}
                    onPointerLeave={onLeave}
                />
            ))}
        </svg>
    );
}
