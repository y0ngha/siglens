import {
    CALL_LABEL_MIDLINE_OFFSET_PX,
    PEAK_LABEL_TOP_OFFSET_PX,
    PUT_LABEL_MIDLINE_OFFSET_PX,
} from '../../utils/chartLabelOffsets';
import { MIDLINE_STROKE_WIDTH } from '../../utils/chartStrokeWidths';
import {
    COLOR_LABEL,
    COLOR_MIDLINE,
    LABEL_CALL,
    LABEL_PUT,
    MIDLINE_Y,
    PAD_LEFT,
    PAD_RIGHT,
    PAD_TOP,
    STRAIGHT_LABEL_FONT_SIZE,
    SVG_WIDTH,
} from '../../utils/strikeChartLayout';

interface StrikeChartScaleProps {
    /** Compact y-scale peak, drawn at the top-left. */
    peakLabel: string;
    /** Label above the midline, e.g. "▲ Call OI". */
    callLabel: string;
    /** Label below the midline, e.g. "▼ Put OI". */
    putLabel: string;
}

/** Midline plus the peak/call/put side labels of a strike bar chart. */
export function StrikeChartScale({
    peakLabel,
    callLabel,
    putLabel,
}: StrikeChartScaleProps) {
    return (
        <>
            <line
                x1={PAD_LEFT}
                y1={MIDLINE_Y}
                x2={SVG_WIDTH - PAD_RIGHT}
                y2={MIDLINE_Y}
                stroke={COLOR_MIDLINE}
                strokeWidth={MIDLINE_STROKE_WIDTH}
            />
            <text
                x={PAD_LEFT}
                y={PAD_TOP - PEAK_LABEL_TOP_OFFSET_PX}
                fill={COLOR_LABEL}
                fontSize={STRAIGHT_LABEL_FONT_SIZE}
                textAnchor="start"
            >
                {peakLabel}
            </text>
            <text
                x={PAD_LEFT}
                y={MIDLINE_Y - CALL_LABEL_MIDLINE_OFFSET_PX}
                fill={LABEL_CALL}
                fontSize={STRAIGHT_LABEL_FONT_SIZE}
                textAnchor="start"
            >
                {callLabel}
            </text>
            <text
                x={PAD_LEFT}
                y={MIDLINE_Y + PUT_LABEL_MIDLINE_OFFSET_PX}
                fill={LABEL_PUT}
                fontSize={STRAIGHT_LABEL_FONT_SIZE}
                textAnchor="start"
            >
                {putLabel}
            </text>
        </>
    );
}
