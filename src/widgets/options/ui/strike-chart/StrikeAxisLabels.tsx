import {
    COLOR_LABEL,
    CHART_WIDTH,
    LABEL_ROTATION_THRESHOLD,
    PAD_BOTTOM,
    PAD_LEFT,
    ROTATED_LABEL_FONT_SIZE,
    STRAIGHT_LABEL_FONT_SIZE,
    SVG_HEIGHT,
    X_AXIS_LABEL_OFFSET_PX,
} from '../../utils/strikeChartLayout';
import { barCenterX } from '../../utils/strikeChartGeometry';

interface StrikeAxisLabelsProps {
    /** Strike values in row order; its length fixes the slot layout. */
    strikes: ReadonlyArray<number>;
    /** Row indices that get a label. */
    labelIndices: ReadonlySet<number>;
}

/**
 * X-axis strike labels for the strike bar charts. Many labels are rotated
 * -45° (end-anchored) to stay legible; few stay horizontal and centered.
 */
export function StrikeAxisLabels({
    strikes,
    labelIndices,
}: StrikeAxisLabelsProps) {
    const rotate = labelIndices.size > LABEL_ROTATION_THRESHOLD;
    const labelY = SVG_HEIGHT - PAD_BOTTOM + X_AXIS_LABEL_OFFSET_PX;

    return strikes.map((strike, i) => {
        if (!labelIndices.has(i)) return null;
        const cx = barCenterX(i, strikes.length, PAD_LEFT, CHART_WIDTH);
        return (
            <text
                key={`lbl-${strike}`}
                x={cx}
                y={labelY}
                fill={COLOR_LABEL}
                fontSize={
                    rotate ? ROTATED_LABEL_FONT_SIZE : STRAIGHT_LABEL_FONT_SIZE
                }
                textAnchor={rotate ? 'end' : 'middle'}
                transform={rotate ? `rotate(-45, ${cx}, ${labelY})` : undefined}
            >
                {strike}
            </text>
        );
    });
}
