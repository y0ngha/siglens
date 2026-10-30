/**
 * 벤치마크 본문의 표 틀과 점수표. 서버에서 그려지는 정적 표다.
 */
import type { ReactNode } from 'react';
import type { BenchmarkTarget } from '@/entities/benchmark/types';
import { cn } from '@/shared/lib/cn';
import { SURFACE_CARD } from '@/shared/lib/surfaceStyles';
import {
    toBenchmarkScoreCells,
    type BenchmarkScoreRow,
} from '../../lib/benchmarkScoreTable';
import { BENCHMARK_ROW, BENCHMARK_TH } from './benchmarkPageStyles';

interface TableShellProps {
    readonly caption: string;
    readonly children: ReactNode;
}

/**
 * 가로로 넘치는 표를 카드 안에서 스크롤시킨다. 캡션은 표의 접근성 이름이다. 좁은 화면에서
 * 스크롤되는 영역에는 포커스할 컨트롤이 없으므로, 키보드로 닿도록 캡션 이름의 `region` +
 * `tabIndex={0}`을 둔다(WCAG 2.1.1).
 */
export function BenchmarkTableShell({ caption, children }: TableShellProps) {
    return (
        <div
            role="region"
            aria-label={caption}
            tabIndex={0}
            className={cn(
                SURFACE_CARD,
                'overflow-x-auto focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none'
            )}
        >
            <table className="w-full min-w-[32rem] text-left text-sm tabular-nums">
                <caption className="px-3 pt-3 pb-1 text-left text-sm font-semibold text-secondary-200">
                    {caption}
                </caption>
                {children}
            </table>
        </div>
    );
}

interface ScoreTableProps {
    readonly caption: string;
    /** 행 머리 칸의 이름(레벨·시장 등). */
    readonly rowHeader: string;
    readonly targets: readonly BenchmarkTarget[];
    readonly rows: readonly BenchmarkScoreRow[];
}

/** 행 = 구분, 열 = 대상. 행마다 가장 높은 점수를 굵게 표시한다(화면에 찍히는 반올림 값이 같으면 동점이라 모두). */
export function BenchmarkScoreTable({
    caption,
    rowHeader,
    targets,
    rows,
}: ScoreTableProps) {
    const targetIds = targets.map(target => target.id);
    return (
        <BenchmarkTableShell caption={caption}>
            <thead>
                <tr>
                    <th scope="col" className={BENCHMARK_TH}>
                        {rowHeader}
                    </th>
                    {targets.map(target => (
                        <th
                            key={target.id}
                            scope="col"
                            className={cn(BENCHMARK_TH, 'text-right')}
                            translate="no"
                        >
                            {target.label}
                        </th>
                    ))}
                </tr>
            </thead>
            <tbody>
                {rows.map(row => (
                    <tr key={row.key} className={BENCHMARK_ROW}>
                        <th
                            scope="row"
                            className="px-3 py-2 font-normal text-secondary-200"
                        >
                            {row.label}
                        </th>
                        {toBenchmarkScoreCells(row, targetIds).map(cell => (
                            <td
                                key={cell.targetId}
                                className={cn(
                                    'px-3 py-2 text-right',
                                    cell.isBest
                                        ? 'font-semibold text-secondary-50'
                                        : 'text-secondary-300'
                                )}
                            >
                                {cell.text}
                            </td>
                        ))}
                    </tr>
                ))}
            </tbody>
        </BenchmarkTableShell>
    );
}
