import type { CSSProperties } from 'react';
import {
    scoreToLabel,
    type FearGreedGroup,
    type FearGreedLabel,
} from '@y0ngha/siglens-core';
import { FACTOR_LABEL, formatFactorRaw } from '@/shared/lib/fearGreedLabels';
import { cn } from '@/shared/lib/cn';

interface FearGreedGroupBarProps {
    group: FearGreedGroup;
}

/** Score → fill color class (semantic tokens; matches FearGreedGauge SEGMENTS). */
const BAR_FILL_COLOR: Record<FearGreedLabel, string> = {
    EXTREME_FEAR: 'bg-ui-danger',
    FEAR: 'bg-ui-warning',
    NEUTRAL: 'bg-secondary-400',
    GREED: 'bg-ui-success/70',
    EXTREME_GREED: 'bg-ui-success',
};

const EXTREME_PERCENTILE_LOW = 10;
const EXTREME_PERCENTILE_HIGH = 90;

export function FearGreedGroupBar({ group }: FearGreedGroupBarProps) {
    const score = Math.round(group.score);
    return (
        <section className="bg-secondary-800/40 flex flex-col gap-2 rounded p-3">
            <header className="flex items-center justify-between">
                <h4 className="text-secondary-200 text-sm font-medium">
                    {group.name} Group
                </h4>
                <span className="text-secondary-100 font-mono text-sm">
                    {score} / 100
                </span>
            </header>
            <div
                role="progressbar"
                aria-label={`${group.name} 그룹 점수 ${score}`}
                aria-valuenow={score}
                aria-valuemin={0}
                aria-valuemax={100}
                className="bg-secondary-700/70 relative h-2 overflow-hidden rounded"
            >
                <div
                    className={cn(
                        'h-full w-(--bar-width)',
                        BAR_FILL_COLOR[scoreToLabel(score)]
                    )}
                    style={{ '--bar-width': `${score}%` } as CSSProperties}
                />
            </div>
            <ul className="text-secondary-400 flex flex-col gap-1 text-xs">
                {group.factors.map(f => {
                    const pctile = Math.round(f.percentile);
                    const isExtreme =
                        pctile < EXTREME_PERCENTILE_LOW ||
                        pctile >= EXTREME_PERCENTILE_HIGH;
                    return (
                        <li
                            key={f.key}
                            className="flex items-center justify-between"
                        >
                            <span>· {FACTOR_LABEL[f.key]}</span>
                            <span className="font-mono">
                                {formatFactorRaw(f.key, f.rawValue)}
                                <span
                                    className={cn(
                                        'ml-2',
                                        isExtreme
                                            ? 'text-secondary-300 font-semibold'
                                            : 'text-secondary-500'
                                    )}
                                >
                                    ({pctile}th)
                                </span>
                            </span>
                        </li>
                    );
                })}
            </ul>
        </section>
    );
}
