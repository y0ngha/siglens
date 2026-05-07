import type { FearGreedSnapshot } from '@y0ngha/siglens-core';
import { SENTIMENT_LABEL_TEXT } from '@/components/fear-greed/utils/labels';

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
 * NEVER use raw Tailwind palette (e.g. yellow-500, red-400). The same tokens are
 * used in Task 5 (SelfNormWarningBadge → ui-warning) and Task 6 (FearGreedHeaderChip).
 */
const SEGMENTS: ReadonlyArray<SegmentDef> = [
    { from: 0, to: 25, strokeClass: 'text-ui-danger' },
    { from: 25, to: 45, strokeClass: 'text-ui-warning' },
    { from: 45, to: 55, strokeClass: 'text-secondary-400' },
    { from: 55, to: 75, strokeClass: 'text-ui-success/60' },
    { from: 75, to: 100, strokeClass: 'text-ui-success' },
];

const GAUGE_CX = 100;
const GAUGE_CY = 100;
const GAUGE_RADIUS = 80;
const GAUGE_STROKE_WIDTH = 14;
const GAUGE_INDICATOR_RADIUS = 6;
const GAUGE_VIEWBOX_W = 200;
const GAUGE_VIEWBOX_H = 110;

/** Hero semicircle gauge for the fearGreed page. 0=left/EXTREME_FEAR, 100=right/EXTREME_GREED. */
export function FearGreedHero({ snapshot }: FearGreedHeroProps) {
    const score = Math.round(snapshot.score);
    // 좌측 끝(EXTREME_FEAR)부터 우측 끝(EXTREME_GREED)으로 진행하는 반원 — 점수가
    // 높을수록 indicator가 오른쪽으로 이동하도록 score=100을 angle=0(가장 우측)에 매핑.
    const angle = (1 - score / 100) * Math.PI;
    const px = GAUGE_CX + GAUGE_RADIUS * Math.cos(angle);
    const py = GAUGE_CY - GAUGE_RADIUS * Math.sin(angle);

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
                <circle
                    cx={px}
                    cy={py}
                    r={GAUGE_INDICATOR_RADIUS}
                    className="fill-secondary-100"
                />
            </svg>
            <div className="text-center">
                <div className="text-secondary-100 text-3xl font-bold tabular-nums">
                    {score}
                </div>
                <div className="text-secondary-300 text-sm">
                    / 100 — {SENTIMENT_LABEL_TEXT[snapshot.label]}
                </div>
            </div>
        </div>
    );
}
