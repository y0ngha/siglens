import { Fragment } from 'react';
import type { CSSProperties, ReactElement } from 'react';

import type { SkillShowcaseItem } from '@/domain/types';
import { DotSeparator } from '@/components/ui/DotSeparator';
import { buildSkillStats } from '@/lib/skillStats';

interface StatsBarProps {
    skills: SkillShowcaseItem[];
}

export function StatsBar({ skills }: StatsBarProps): ReactElement {
    const stats = buildSkillStats(skills);

    return (
        <div className="text-secondary-400 mt-6 flex flex-wrap items-center justify-center gap-x-2 font-mono text-xs lg:justify-start">
            {stats.map((stat, i) => (
                <Fragment key={stat.label}>
                    {i > 0 && <DotSeparator />}
                    <span>
                        {stat.value}
                        {stat.label}
                    </span>
                </Fragment>
            ))}
        </div>
    );
}

export function StatsBarSkeleton(): ReactElement {
    return (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-x-2 lg:justify-start">
            {[80, 60, 72, 56, 68, 64].map((w, i) => (
                <Fragment key={i}>
                    {i > 0 && <DotSeparator />}
                    <div
                        className="bg-secondary-700/50 h-3 w-[var(--stat-w)] animate-pulse rounded"
                        style={{ '--stat-w': `${w}px` } as CSSProperties}
                    />
                </Fragment>
            ))}
        </div>
    );
}
