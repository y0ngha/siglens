import type { FinancialsGrade } from '@y0ngha/siglens-core';
import { cn } from '@/shared/lib/cn';

interface CompositeGradeGaugeProps {
    /** Composite score 0–100; null renders "—" in place of the number. */
    score: number | null;
    /** Letter grade derived from score. */
    grade: FinancialsGrade;
    /** Korean one-line summary naming the strongest and weakest axis. */
    summaryKo: string;
}

/**
 * Segment definition for the semicircle gauge arc.
 * Each segment maps a score range to a Tailwind semantic stroke color.
 */
interface SegmentDef {
    from: number;
    to: number;
    /** Tailwind text-color class applied via stroke="currentColor". */
    strokeClass: string;
}

/**
 * 5-segment palette using design-system semantic tokens:
 *   0–34   → text-ui-danger       (F/D — danger)
 *   35–49  → text-ui-warning      (D/C — caution)
 *   50–64  → text-secondary-400   (C — neutral)
 *   65–79  → text-ui-success/60   (B — lighter success)
 *   80–100 → text-ui-success      (A — strongest success)
 */
const SEGMENTS: ReadonlyArray<SegmentDef> = [
    { from: 0, to: 35, strokeClass: 'text-ui-danger' },
    { from: 35, to: 50, strokeClass: 'text-ui-warning' },
    { from: 50, to: 65, strokeClass: 'text-secondary-400' },
    { from: 65, to: 80, strokeClass: 'text-ui-success/60' },
    { from: 80, to: 100, strokeClass: 'text-ui-success' },
];

/** Grade → large letter text color (semantic tokens only). */
const GRADE_TEXT_COLOR: Record<FinancialsGrade, string> = {
    A: 'text-ui-success',
    B: 'text-chart-bullish',
    C: 'text-ui-warning',
    D: 'text-ui-danger',
    F: 'text-chart-bearish',
};

const GAUGE_CX = 100;
/** Slight top padding so tick labels above the arc still fit the viewBox. */
const GAUGE_CY = 105;
const GAUGE_RADIUS = 80;
const GAUGE_STROKE_WIDTH = 14;
const GAUGE_VIEWBOX_W = 200;
const GAUGE_VIEWBOX_H = 130;

/** Triangular needle geometry — drawn at angle=0 and rotated to score angle. */
const NEEDLE_TIP_LEN = 4;
const NEEDLE_HALF_WIDTH = 6;
const NEEDLE_INNER_GAP = 12;
/** Pivot circle radius anchoring the needle visually. */
const NEEDLE_PIVOT_RADIUS = 4;

/** Degrees per score unit — 180° gauge arc spans 100 score units. */
const DEGREES_PER_SCORE_UNIT = 1.8;

/** Tick values rendered as labels outside the arc. */
const TICK_VALUES: ReadonlyArray<number> = [0, 25, 50, 75, 100];

function tickDy(value: number): number {
    return value === 0 || value === 100 ? 14 : 0;
}

function tickTextAnchor(value: number): 'start' | 'end' | 'middle' {
    if (value === 0) return 'start';
    if (value === 100) return 'end';
    return 'middle';
}

const TICK_LABEL_OFFSET = 16;
const TICK_LABEL_RADIUS = GAUGE_RADIUS + TICK_LABEL_OFFSET;

/**
 * Semicircle SVG gauge showing composite financials score 0–100.
 *
 * Adapts the FearGreedGauge semicircle pattern for the financials scorecard.
 * Score 0 = left (worst), 100 = right (best). Includes a needle pointer,
 * tick labels, large grade letter, and a Korean summary line.
 *
 * Accessibility: `role="img"` + `aria-label` on the SVG.
 * Null score renders "—" in place of the numeric value.
 */
export function CompositeGradeGauge({
    score,
    grade,
    summaryKo,
}: CompositeGradeGaugeProps) {
    // Clamp to [0,100] for needle rotation; default 0 when score is null.
    const clampedScore = score !== null ? Math.min(100, Math.max(0, score)) : 0;

    // Needle drawn pointing right (score=100); rotate left by (100 - score) * 1.8°
    const rotateDeg = -(100 - clampedScore) * DEGREES_PER_SCORE_UNIT;

    const tipR = GAUGE_RADIUS + NEEDLE_TIP_LEN;
    const baseR = NEEDLE_INNER_GAP;
    const tipX = GAUGE_CX + tipR;
    const tipY = GAUGE_CY;
    const baseLeftX = GAUGE_CX + baseR;
    const baseLeftY = GAUGE_CY - NEEDLE_HALF_WIDTH;
    const baseRightX = GAUGE_CX + baseR;
    const baseRightY = GAUGE_CY + NEEDLE_HALF_WIDTH;

    const ariaLabel =
        score !== null
            ? `재무 종합 점수 ${score}점, 등급 ${grade}`
            : `재무 종합 점수 없음, 등급 ${grade}`;

    const gradeColorClass = GRADE_TEXT_COLOR[grade];

    return (
        <div className="flex flex-col items-center gap-2">
            <svg
                viewBox={`0 0 ${GAUGE_VIEWBOX_W} ${GAUGE_VIEWBOX_H}`}
                className="w-full max-w-[420px]"
                role="img"
                aria-label={ariaLabel}
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
                    const ly =
                        GAUGE_CY -
                        TICK_LABEL_RADIUS * Math.sin(a) +
                        tickDy(value);
                    return (
                        <text
                            key={value}
                            x={lx}
                            y={ly}
                            textAnchor={tickTextAnchor(value)}
                            dominantBaseline="middle"
                            className="text-secondary-400 fill-current text-[10px] font-medium tabular-nums"
                        >
                            {value}
                        </text>
                    );
                })}
                <g transform={`rotate(${rotateDeg} ${GAUGE_CX} ${GAUGE_CY})`}>
                    <polygon
                        points={`${tipX},${tipY} ${baseLeftX},${baseLeftY} ${baseRightX},${baseRightY}`}
                        className="fill-secondary-100"
                    />
                </g>
                <circle
                    cx={GAUGE_CX}
                    cy={GAUGE_CY}
                    r={NEEDLE_PIVOT_RADIUS}
                    className="fill-secondary-100"
                />
            </svg>
            <div className="text-center">
                <div className="flex items-baseline justify-center gap-1.5">
                    <span className="text-secondary-100 font-mono text-5xl font-bold tabular-nums">
                        {score !== null ? score : '—'}
                    </span>
                    {score !== null && (
                        <span className="text-secondary-400 text-xs">
                            / 100
                        </span>
                    )}
                </div>
                <div
                    className={cn(
                        'text-4xl font-bold tracking-tight',
                        gradeColorClass
                    )}
                >
                    {grade}
                </div>
                <div className="text-secondary-300 mt-1 text-sm">
                    {summaryKo}
                </div>
            </div>
        </div>
    );
}
