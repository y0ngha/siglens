import type { ReactNode } from 'react';
import type { BenchmarkTarget } from '@/entities/benchmark/types';
import { cn } from '@/shared/lib/cn';
import { SURFACE_CARD } from '@/shared/lib/surfaceStyles';
import {
    formatBenchmarkScore,
    roundBenchmarkScore,
} from '@/shared/lib/benchmarkFormat';

const TH =
    'px-3 py-2 text-xs font-semibold text-secondary-400 whitespace-nowrap';

interface TableShellProps {
    readonly caption: string;
    readonly children: ReactNode;
}

/** 가로로 넘치는 표를 카드 안에서 스크롤시킨다. 캡션은 표의 접근성 이름이다. */
export function BenchmarkTableShell({ caption, children }: TableShellProps) {
    return (
        <div className={cn(SURFACE_CARD, 'overflow-x-auto')}>
            <table className="w-full min-w-[32rem] text-left text-sm tabular-nums">
                <caption className="px-3 pt-3 pb-1 text-left text-sm font-semibold text-secondary-200">
                    {caption}
                </caption>
                {children}
            </table>
        </div>
    );
}

export interface ScoreRow {
    readonly key: string;
    readonly label: string;
    readonly scores: Readonly<Record<string, number | null>>;
}

interface ScoreTableProps {
    readonly caption: string;
    /** 행 머리 칸의 이름(레벨·시장 등). */
    readonly rowHeader: string;
    readonly targets: readonly BenchmarkTarget[];
    readonly rows: readonly ScoreRow[];
}

/** 행 = 구분, 열 = 대상. 행마다 가장 높은 점수를 굵게 표시한다(화면에 찍히는 반올림 값이 같으면 동점이라 모두). */
export function BenchmarkScoreTable({
    caption,
    rowHeader,
    targets,
    rows,
}: ScoreTableProps) {
    return (
        <BenchmarkTableShell caption={caption}>
            <thead>
                <tr>
                    <th scope="col" className={TH}>
                        {rowHeader}
                    </th>
                    {targets.map(target => (
                        <th
                            key={target.id}
                            scope="col"
                            className={cn(TH, 'text-right')}
                            translate="no"
                        >
                            {target.label}
                        </th>
                    ))}
                </tr>
            </thead>
            <tbody>
                {rows.map(row => {
                    const values = targets.flatMap(target => {
                        const value = row.scores[target.id];
                        return value === null || value === undefined
                            ? []
                            : [roundBenchmarkScore(value)];
                    });
                    const best = values.length > 0 ? Math.max(...values) : null;
                    return (
                        <tr
                            key={row.key}
                            className="border-t border-secondary-700"
                        >
                            <th
                                scope="row"
                                className="px-3 py-2 font-normal text-secondary-200"
                            >
                                {row.label}
                            </th>
                            {targets.map(target => {
                                const value = row.scores[target.id] ?? null;
                                return (
                                    <td
                                        key={target.id}
                                        className={cn(
                                            'px-3 py-2 text-right',
                                            value !== null &&
                                                roundBenchmarkScore(value) ===
                                                    best
                                                ? 'font-semibold text-secondary-50'
                                                : 'text-secondary-300'
                                        )}
                                    >
                                        {formatBenchmarkScore(value)}
                                    </td>
                                );
                            })}
                        </tr>
                    );
                })}
            </tbody>
        </BenchmarkTableShell>
    );
}
