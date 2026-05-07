import type { CSSProperties } from 'react';
import type { FearGreedGroup } from '@y0ngha/siglens-core';
import {
    FACTOR_LABEL,
    formatFactorRaw,
} from '@/components/fear-greed/utils/labels';

interface FearGreedGroupBarProps {
    group: FearGreedGroup;
}

// Pure presentational — renders directly inside a Server Component when invoked at RSC level.
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
                className="bg-secondary-700/40 relative h-2 overflow-hidden rounded"
            >
                <div
                    className="bg-primary-500 h-full w-(--bar-width)"
                    style={{ '--bar-width': `${score}%` } as CSSProperties}
                />
            </div>
            <ul className="text-secondary-400 flex flex-col gap-1 text-xs">
                {group.factors.map(f => (
                    <li
                        key={f.key}
                        className="flex items-center justify-between"
                    >
                        <span>· {FACTOR_LABEL[f.key]}</span>
                        <span className="font-mono">
                            {formatFactorRaw(f.key, f.rawValue)}
                            <span className="text-secondary-500 ml-2">
                                ({Math.round(f.percentile)}th)
                            </span>
                        </span>
                    </li>
                ))}
            </ul>
        </section>
    );
}
