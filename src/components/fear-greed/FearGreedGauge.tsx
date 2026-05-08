import type { FearGreedLabel } from '@y0ngha/siglens-core';
import { SENTIMENT_LABEL_TEXT } from '@/lib/fearGreedLabels';
import { FEAR_GREED_SCORE_BOUNDARIES } from '@/domain/fearGreed/classifier';
import { cn } from '@/lib/cn';

const { EXTREME_FEAR_MAX, FEAR_MAX, NEUTRAL_MAX, GREED_MAX } =
    FEAR_GREED_SCORE_BOUNDARIES;

interface FearGreedGaugeProps {
    score: number;
    label: FearGreedLabel;
    /** Visual variant — Hero is the focal stack; mini is for comparison tiles. */
    size: 'hero' | 'mini';
    /** Optional period label rendered under the score (e.g. "1주", "1개월"). Mini only. */
    periodLabel?: string;
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
    { from: 0, to: EXTREME_FEAR_MAX, strokeClass: 'text-ui-danger' },
    { from: EXTREME_FEAR_MAX, to: FEAR_MAX, strokeClass: 'text-ui-warning' },
    { from: FEAR_MAX, to: NEUTRAL_MAX, strokeClass: 'text-secondary-400' },
    { from: NEUTRAL_MAX, to: GREED_MAX, strokeClass: 'text-ui-success/60' },
    { from: GREED_MAX, to: 100, strokeClass: 'text-ui-success' },
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
/** 게이지 회전 중심을 시각적으로 anchor하는 작은 피벗 원의 반지름 (SVG units). */
const NEEDLE_PIVOT_RADIUS = 4;

/** Tick label radial offset outside the arc, in SVG units. */
const TICK_LABEL_OFFSET = 16;
const TICK_LABEL_RADIUS = GAUGE_RADIUS + TICK_LABEL_OFFSET;
const TICK_VALUES: ReadonlyArray<number> = [0, 25, 50, 75, 100];

/** Degrees per score unit — 180° gauge arc spans 100 score units (180 / 100). */
const DEGREES_PER_SCORE_UNIT = 1.8;

/**
 * Shared semicircle gauge primitive. 0=left/EXTREME_FEAR, 100=right/EXTREME_GREED.
 *
 * - `size='hero'`: full focal stack (large score + sentiment word + "/ 100"), tick labels rendered.
 * - `size='mini'`: compact variant for comparison tiles (small score + period label, no ticks/sentiment).
 */
export function FearGreedGauge({
    score,
    label,
    size,
    periodLabel,
}: FearGreedGaugeProps) {
    // 0 → +180°(좌측), 100 → 0°(우측). 정적 needle을 우측 기준으로 그린 뒤
    // -score * DEGREES_PER_SCORE_UNIT 만큼 회전(시계 반대 방향, SVG 좌표계에서
    // 음수 각도)시켜 위치를 잡는다.
    const rotateDeg = -score * DEGREES_PER_SCORE_UNIT;

    const tipR = GAUGE_RADIUS + NEEDLE_TIP_LEN;
    const baseR = NEEDLE_INNER_GAP;
    const tipX = GAUGE_CX + tipR;
    const tipY = GAUGE_CY;
    const baseLeftX = GAUGE_CX + baseR;
    const baseLeftY = GAUGE_CY - NEEDLE_HALF_WIDTH;
    const baseRightX = GAUGE_CX + baseR;
    const baseRightY = GAUGE_CY + NEEDLE_HALF_WIDTH;

    const isHero = size === 'hero';
    const ariaLabel = isHero
        ? `공포·탐욕 지수 ${score}점, ${SENTIMENT_LABEL_TEXT[label]}`
        : periodLabel
          ? `${periodLabel} 공포·탐욕 지수 ${score}점, ${SENTIMENT_LABEL_TEXT[label]}`
          : `공포·탐욕 지수 ${score}점`;

    return (
        <div className="flex flex-col items-center gap-2">
            <svg
                viewBox={`0 0 ${GAUGE_VIEWBOX_W} ${GAUGE_VIEWBOX_H}`}
                className={cn(
                    'w-full',
                    isHero ? 'max-w-[420px]' : 'max-w-[120px]'
                )}
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
                {isHero &&
                    TICK_VALUES.map(value => {
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
                {isHero ? (
                    <>
                        <div className="text-secondary-100 text-5xl font-bold tabular-nums">
                            {score}
                        </div>
                        <div
                            className={cn(
                                'text-2xl font-semibold tracking-tight',
                                SENTIMENT_TEXT_COLOR[label]
                            )}
                        >
                            {SENTIMENT_LABEL_TEXT[label]}
                        </div>
                        <div className="text-secondary-400 text-xs">/ 100</div>
                    </>
                ) : (
                    <>
                        <div className="text-secondary-100 text-xl font-semibold tabular-nums">
                            {score}
                        </div>
                        {periodLabel ? (
                            <div className="text-secondary-400 text-[10px]">
                                {periodLabel}
                            </div>
                        ) : null}
                    </>
                )}
            </div>
        </div>
    );
}
