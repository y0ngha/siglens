import type { ReactElement } from 'react';
import type { FearGreedHistoryPoint } from '@y0ngha/siglens-core';

interface FearGreedComparisonGaugesProps {
    history: FearGreedHistoryPoint[];
}

interface PeriodDef {
    key: 'now' | '1w' | '1m' | '1y';
    daysBack: number;
    label: string;
}

const PERIODS: ReadonlyArray<PeriodDef> = [
    { key: 'now', daysBack: 0, label: 'Now' },
    { key: '1w', daysBack: 5, label: '1주' },
    { key: '1m', daysBack: 21, label: '1개월' },
    { key: '1y', daysBack: 252, label: '1년' },
];

const MISSING_VALUE = '—';

/** Renders the 4 historical reference points so the user can compare current sentiment to past windows. */
// Pure presentational — renders directly inside a Server Component when invoked at RSC level.
export function FearGreedComparisonGauges({
    history,
}: FearGreedComparisonGaugesProps): ReactElement | null {
    const valid = history.filter(p => p.score !== null);
    if (valid.length === 0) return null;
    const lastIdx = valid.length - 1;
    return (
        <ul className="flex justify-around gap-2 text-center text-xs">
            {PERIODS.map(p => {
                const point = valid[Math.max(0, lastIdx - p.daysBack)];
                return (
                    <li
                        key={p.key}
                        className="bg-secondary-800/40 flex-1 rounded p-2"
                    >
                        <div className="text-secondary-400">{p.label}</div>
                        <div className="text-secondary-100 mt-1 text-base font-semibold tabular-nums">
                            {point
                                ? Math.round(point.score as number)
                                : MISSING_VALUE}
                        </div>
                    </li>
                );
            })}
        </ul>
    );
}
