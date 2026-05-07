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

/**
 * 4 mini tiles showing Now / 1W / 1M / 1Y scores from the walk-forward history.
 * daysBack values approximate trading days (5 = 1 week, 21 = 1 month, 252 = 1 year).
 */
export function FearGreedComparisonGauges({
    history,
}: FearGreedComparisonGaugesProps) {
    const valid = history.filter(p => p.score !== null);
    if (valid.length === 0) return null;
    const lastIdx = valid.length - 1;
    return (
        <ul className="flex justify-around gap-2 text-center text-xs">
            {PERIODS.map(p => {
                const point = valid[Math.max(0, lastIdx - p.daysBack)];
                const score = point?.score;
                return (
                    <li
                        key={p.key}
                        className="bg-secondary-800/40 flex-1 rounded p-2"
                    >
                        <div className="text-secondary-400">{p.label}</div>
                        <div className="text-secondary-100 mt-1 text-base font-semibold tabular-nums">
                            {score === null || score === undefined
                                ? MISSING_VALUE
                                : Math.round(score)}
                        </div>
                    </li>
                );
            })}
        </ul>
    );
}
