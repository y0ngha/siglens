import { type PointerEvent } from 'react';
import {
    BAR_WIDTH_FILL_RATIO,
    CHART_HEIGHT,
    CHART_WIDTH,
    COLOR_CALL,
    COLOR_PUT,
    HALF_HEIGHT,
    MIDLINE_Y,
    PAD_LEFT,
    PAD_TOP,
} from '../../utils/strikeChartLayout';
import {
    barCenterX,
    barPixelHeight,
    slotWidth,
} from '../../utils/strikeChartGeometry';

/** One strike's bar pair plus how strongly it is drawn. */
export interface StrikeBarDatum {
    strike: number;
    /** Call-side magnitude (OI or volume). */
    call: number;
    /** Put-side magnitude (OI or volume). */
    put: number;
    /** Bar opacity (0-1). */
    opacity: number;
}

type StrikePointerHandler = (
    event: PointerEvent<SVGRectElement>,
    index: number
) => void;

interface StrikeBarsProps {
    bars: ReadonlyArray<StrikeBarDatum>;
    /** Shared y-scale maximum for both sides. */
    globalMax: number;
    /** Tooltip element id the transparent hit rects point `aria-describedby` at. */
    tooltipId: string;
    onPointerEnter: StrikePointerHandler;
    onPointerMove: StrikePointerHandler;
    onPointerLeave: () => void;
}

/**
 * Mirrored call (up) / put (down) bars around the midline, each strike backed
 * by a full-height transparent hit rect that drives the hover tooltip.
 */
export function StrikeBars({
    bars,
    globalMax,
    tooltipId,
    onPointerEnter,
    onPointerMove,
    onPointerLeave,
}: StrikeBarsProps) {
    const count = bars.length;
    const sw = slotWidth(count, CHART_WIDTH);
    const bw = sw * BAR_WIDTH_FILL_RATIO;

    return bars.map((bar, i) => {
        const cx = barCenterX(i, count, PAD_LEFT, CHART_WIDTH);
        const callH = barPixelHeight(bar.call, globalMax, HALF_HEIGHT);
        const putH = barPixelHeight(bar.put, globalMax, HALF_HEIGHT);

        return (
            <g key={bar.strike}>
                {bar.call > 0 && (
                    <rect
                        x={cx - bw / 2}
                        y={MIDLINE_Y - callH}
                        width={bw}
                        height={callH}
                        fill={COLOR_CALL}
                        opacity={bar.opacity}
                    />
                )}
                {bar.put > 0 && (
                    <rect
                        x={cx - bw / 2}
                        y={MIDLINE_Y}
                        width={bw}
                        height={putH}
                        fill={COLOR_PUT}
                        opacity={bar.opacity}
                    />
                )}
                <rect
                    x={cx - sw / 2}
                    y={PAD_TOP}
                    width={sw}
                    height={CHART_HEIGHT}
                    fill="white"
                    fillOpacity={0}
                    pointerEvents="all"
                    aria-describedby={tooltipId}
                    onPointerEnter={e => onPointerEnter(e, i)}
                    onPointerMove={e => onPointerMove(e, i)}
                    onPointerLeave={onPointerLeave}
                />
            </g>
        );
    });
}
