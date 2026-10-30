import {
    CHART_WIDTH,
    COLOR_GUIDE_LINE,
    PAD_BOTTOM,
    PAD_LEFT,
    PAD_TOP,
    SVG_HEIGHT,
} from '../../utils/strikeChartLayout';
import { GUIDE_LINE_STROKE_WIDTH } from '../../utils/chartStrokeWidths';
import { barCenterX } from '../../utils/strikeChartGeometry';

interface StrikeGuideLinesProps {
    /** Number of strike slots. */
    count: number;
    /** Slot index of the strike nearest the spot price; negative hides the line. */
    currentPriceIdx: number;
    /** Slot index of the Max Pain strike; omit or pass a negative index to hide it. */
    maxPainIdx?: number;
}

interface GuideLineProps {
    index: number;
    count: number;
    dashed: boolean;
}

function GuideLine({ index, count, dashed }: GuideLineProps) {
    if (index < 0) return null;
    const x = barCenterX(index, count, PAD_LEFT, CHART_WIDTH);
    return (
        <line
            x1={x}
            y1={PAD_TOP}
            x2={x}
            y2={SVG_HEIGHT - PAD_BOTTOM}
            stroke={COLOR_GUIDE_LINE}
            strokeWidth={GUIDE_LINE_STROKE_WIDTH}
            strokeDasharray={dashed ? '4 4' : undefined}
        />
    );
}

/**
 * Vertical pivot lines: an optional dashed Max Pain line and the solid
 * current-price line. They share a color; dashed vs solid tells them apart.
 */
export function StrikeGuideLines({
    count,
    currentPriceIdx,
    maxPainIdx = -1,
}: StrikeGuideLinesProps) {
    return (
        <>
            <GuideLine index={maxPainIdx} count={count} dashed />
            <GuideLine index={currentPriceIdx} count={count} dashed={false} />
        </>
    );
}
