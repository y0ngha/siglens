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

/** Renders the 4 historical reference points so the user can compare current sentiment to past windows. */
// Pure presentational — renders directly inside a Server Component when invoked at RSC level.
export function FearGreedComparisonGauges({
    history,
}: FearGreedComparisonGaugesProps) {
    const valid = history.filter(
        (p): p is FearGreedHistoryPoint & { score: number } => p.score !== null
    );
    if (valid.length === 0) return null;
    const lastIdx = valid.length - 1;
    return (
        <ul className="flex justify-around gap-2 text-center text-xs">
            {PERIODS.map(p => {
                const point = valid[Math.max(0, lastIdx - p.daysBack)];
                // valid 배열은 score!==null 필터 통과 요소만 보유. 인덱스도 Math.max로 클램프 → point 항상 정의됨.
                return (
                    <li
                        key={p.key}
                        className="bg-secondary-800/40 flex-1 rounded p-2"
                    >
                        <div className="text-secondary-400">{p.label}</div>
                        <div className="text-secondary-100 mt-1 text-base font-semibold tabular-nums">
                            {Math.round(point.score)}
                        </div>
                    </li>
                );
            })}
        </ul>
    );
}
