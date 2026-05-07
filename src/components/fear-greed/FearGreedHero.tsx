import type { FearGreedSnapshot } from '@y0ngha/siglens-core';

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

const LABEL_TEXT: Record<FearGreedSnapshot['label'], string> = {
    EXTREME_FEAR: '극공포',
    FEAR: '공포',
    NEUTRAL: '중립',
    GREED: '탐욕',
    EXTREME_GREED: '극탐욕',
};

/** Hero semicircle gauge for the fearGreed page. 0=left/EXTREME_FEAR, 100=right/EXTREME_GREED. */
export function FearGreedHero({ snapshot }: FearGreedHeroProps) {
    const score = Math.round(snapshot.score);
    const angle = (1 - score / 100) * Math.PI; // 100 → 0rad(우), 0 → π(좌)
    const cx = 100;
    const cy = 100;
    const r = 80;
    const px = cx + r * Math.cos(angle);
    const py = cy - r * Math.sin(angle);

    return (
        <div className="flex flex-col items-center gap-2">
            <svg
                viewBox="0 0 200 110"
                className="w-full max-w-[420px]"
                role="img"
                aria-label={`공포·탐욕 지수 ${score}점, ${LABEL_TEXT[snapshot.label]}`}
            >
                {SEGMENTS.map(seg => {
                    const a1 = (1 - seg.from / 100) * Math.PI;
                    const a2 = (1 - seg.to / 100) * Math.PI;
                    const x1 = cx + r * Math.cos(a1);
                    const y1 = cy - r * Math.sin(a1);
                    const x2 = cx + r * Math.cos(a2);
                    const y2 = cy - r * Math.sin(a2);
                    return (
                        <path
                            key={seg.from}
                            d={`M ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2}`}
                            strokeWidth={14}
                            fill="none"
                            stroke="currentColor"
                            className={seg.strokeClass}
                        />
                    );
                })}
                <circle cx={px} cy={py} r={6} className="fill-secondary-100" />
            </svg>
            <div className="text-center">
                <div className="text-secondary-100 text-3xl font-bold tabular-nums">
                    {score}
                </div>
                <div className="text-secondary-300 text-sm">
                    / 100 — {LABEL_TEXT[snapshot.label]}
                </div>
            </div>
        </div>
    );
}
