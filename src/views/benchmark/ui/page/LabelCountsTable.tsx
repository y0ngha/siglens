/**
 * 대상별 판정 개수 표(primary 객관 문항).
 */
import {
    BENCHMARK_LABELS,
    type BenchmarkBreakdown,
    type BenchmarkLabel,
    type BenchmarkTarget,
} from '@/entities/benchmark/types';
import { cn } from '@/shared/lib/cn';
import { BENCHMARK_ROW, BENCHMARK_TH } from './benchmarkPageStyles';
import { BenchmarkTableShell } from './BenchmarkScoreTables';

interface Props {
    readonly caption: string;
    /** 행 머리 칸의 이름. */
    readonly targetHeader: string;
    readonly targets: readonly BenchmarkTarget[];
    readonly labelCounts: BenchmarkBreakdown['labelCounts'];
    /** 판정 이름(번역됨). */
    readonly labelText: Readonly<Record<BenchmarkLabel, string>>;
}

/** 행 = 대상, 열 = 판정. 기록이 없는 칸은 0이다. */
export function LabelCountsTable({
    caption,
    targetHeader,
    targets,
    labelCounts,
    labelText,
}: Props) {
    return (
        <BenchmarkTableShell caption={caption}>
            <thead>
                <tr>
                    <th scope="col" className={BENCHMARK_TH}>
                        {targetHeader}
                    </th>
                    {BENCHMARK_LABELS.map(label => (
                        <th
                            key={label}
                            scope="col"
                            className={cn(BENCHMARK_TH, 'text-right')}
                        >
                            {labelText[label]}
                        </th>
                    ))}
                </tr>
            </thead>
            <tbody>
                {targets.map(target => (
                    <tr key={target.id} className={BENCHMARK_ROW}>
                        <th
                            scope="row"
                            className="px-3 py-2 font-normal text-secondary-200"
                            translate="no"
                        >
                            {target.label}
                        </th>
                        {BENCHMARK_LABELS.map(label => (
                            <td
                                key={label}
                                className="px-3 py-2 text-right text-secondary-300"
                            >
                                {labelCounts[target.id]?.[label] ?? 0}
                            </td>
                        ))}
                    </tr>
                ))}
            </tbody>
        </BenchmarkTableShell>
    );
}
