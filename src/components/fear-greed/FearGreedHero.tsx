import type { FearGreedLabel, FearGreedSnapshot } from '@y0ngha/siglens-core';
import { SENTIMENT_LABEL_TEXT } from '@/components/fear-greed/utils/labels';
import { cn } from '@/lib/cn';

interface FearGreedHeroProps {
    snapshot: FearGreedSnapshot;
}

interface SegmentDef {
    from: number;
    to: number;
    /** Tailwind text-color class applied via stroke="currentColor". */
    strokeClass: string;
}

/**
 * 5-segment palette mapped to design-system semantic tokens (see src/app/globals.css):
 *   EXTREME_FEAR  → text-ui-danger        (#ef5350) — strongest danger
 *   FEAR          → text-ui-warning       (#f59e0b) — warning/caution
 *   NEUTRAL       → text-secondary-400    (#94a3b8) — muted slate
 *   GREED         → text-ui-success/60    (#26a69a @ 60%) — lighter success
 *   EXTREME_GREED → text-ui-success       (#26a69a) — strongest success
 *
 * NEVER use raw Tailwind palette (e.g. yellow-500, red-400).
 * SelfNormWarningBadge와 FearGreedHeaderChip에서도 동일한 시맨틱 토큰을 사용한다.
 */
const SEGMENTS: ReadonlyArray<SegmentDef> = [
    { from: 0, to: 25, strokeClass: 'text-ui-danger' },
    { from: 25, to: 45, strokeClass: 'text-ui-warning' },
    { from: 45, to: 55, strokeClass: 'text-secondary-400' },
    { from: 55, to: 75, strokeClass: 'text-ui-success/60' },
    { from: 75, to: 100, strokeClass: 'text-ui-success' },
];

/** Sentiment-label → focal-stack text color (semantic tokens only). */
const SENTIMENT_TEXT_COLOR: Record<FearGreedLabel, string> = {
    EXTREME_FEAR: 'text-ui-danger',
    FEAR: 'text-ui-warning',
    NEUTRAL: 'text-secondary-300',
    GREED: 'text-ui-success/80',
    EXTREME_GREED: 'text-ui-success',
};

const GAUGE_CX = 100;
// Slight top padding so tick labels above the arc still fit the viewBox.
const GAUGE_CY = 105;
const GAUGE_RADIUS = 80;
const GAUGE_STROKE_WIDTH = 14;
const GAUGE_VIEWBOX_W = 200;
// Bumped from 110 → 130 to fit tick labels rendered outside the arc.
const GAUGE_VIEWBOX_H = 130;

/** Triangular needle geometry — drawn at angle=0 and rotated to score angle. */
const NEEDLE_TIP_LEN = 4;
const NEEDLE_HALF_WIDTH = 6;
const NEEDLE_INNER_GAP = 12;

/** Tick label radial offset outside the arc. */
const TICK_LABEL_RADIUS = GAUGE_RADIUS + 16;
const TICK_VALUES: ReadonlyArray<number> = [0, 25, 50, 75, 100];

/** Hero semicircle gauge for the fearGreed page. 0=left/EXTREME_FEAR, 100=right/EXTREME_GREED. */
export function FearGreedHero({ snapshot }: FearGreedHeroProps) {
    const score = Math.round(snapshot.score);
    // 0 → +180°(좌측), 100 → 0°(우측). 정적 needle을 우측 기준으로 그린 뒤 -score*1.8°
    // 만큼 회전(시계 반대 방향, SVG 좌표계에서 음수 각도)시켜 위치를 잡는다.
    const rotateDeg = -score * 1.8;

    // Static needle points at angle = 0 (rightmost). Rotated by <g transform=…>.
    const tipR = GAUGE_RADIUS + NEEDLE_TIP_LEN;
    const baseR = NEEDLE_INNER_GAP;
    const tipX = GAUGE_CX + tipR;
    const tipY = GAUGE_CY;
    const baseLeftX = GAUGE_CX + baseR;
    const baseLeftY = GAUGE_CY - NEEDLE_HALF_WIDTH;
    const baseRightX = GAUGE_CX + baseR;
    const baseRightY = GAUGE_CY + NEEDLE_HALF_WIDTH;

    return (
        <div className="flex flex-col items-center gap-2">
            <svg
                viewBox={`0 0 ${GAUGE_VIEWBOX_W} ${GAUGE_VIEWBOX_H}`}
                className="w-full max-w-[420px]"
                role="img"
                aria-label={`공포·탐욕 지수 ${score}점, ${SENTIMENT_LABEL_TEXT[snapshot.label]}`}
            >
                {SEGMENTS.map(seg => {
                    const a1 = (1 - seg.from / 100) * Math.PI;
                    const a2 = (1 - seg.to / 100) * Math.PI;
                    const x1 = GAUGE_CX + GAUGE_RADIUS * Math.cos(a1);
                    const y1 = GAUGE_CY - GAUGE_RADIUS * Math.sin(a1);
                    const x2 = GAUGE_CX + GAUGE_RADIUS * Math.cos(a2);
                    const y2 = GAUGE_CY - GAUGE_RADIUS * Math.sin(a2);
                    return (
                        <path
                            key={seg.from}
                            d={`M ${x1} ${y1} A ${GAUGE_RADIUS} ${GAUGE_RADIUS} 0 0 1 ${x2} ${y2}`}
                            strokeWidth={GAUGE_STROKE_WIDTH}
                            fill="none"
                            stroke="currentColor"
                            className={seg.strokeClass}
                        />
                    );
                })}
                {TICK_VALUES.map(value => {
                    const a = (1 - value / 100) * Math.PI;
                    const lx = GAUGE_CX + TICK_LABEL_RADIUS * Math.cos(a);
                    const ly = GAUGE_CY - TICK_LABEL_RADIUS * Math.sin(a);
                    return (
                        <text
                            key={value}
                            x={lx}
                            y={ly}
                            textAnchor="middle"
                            dominantBaseline="middle"
                            className="text-secondary-400 fill-current text-[10px] font-medium tabular-nums"
                        >
                            {value}
                        </text>
                    );
                })}
                <g
                    transform={`rotate(${rotateDeg} ${GAUGE_CX} ${GAUGE_CY})`}
                >
                    <polygon
                        points={`${tipX},${tipY} ${baseLeftX},${baseLeftY} ${baseRightX},${baseRightY}`}
                        className="fill-secondary-100"
                    />
                </g>
                <circle
                    cx={GAUGE_CX}
                    cy={GAUGE_CY}
                    r={4}
                    className="fill-secondary-100"
                />
            </svg>
            <div className="text-center">
                <div className="text-secondary-100 text-5xl font-bold tabular-nums">
                    {score}
                </div>
                <div
                    className={cn(
                        'text-2xl font-semibold tracking-tight',
                        SENTIMENT_TEXT_COLOR[snapshot.label]
                    )}
                >
                    {SENTIMENT_LABEL_TEXT[snapshot.label]}
                </div>
                <div className="text-secondary-400 text-xs">/ 100</div>
            </div>
        </div>
    );
}
