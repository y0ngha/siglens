/**
 * 헤드라인 비교표 — 대상마다 점수 차·신뢰구간·p값·문항 수·해석 한 줄.
 */
import { cn } from '@/shared/lib/cn';
import type { BenchmarkHeadlineRow } from '../../lib/benchmarkPageModel';
import { BENCHMARK_ROW, BENCHMARK_TH } from './benchmarkPageStyles';
import { BenchmarkTableShell } from './BenchmarkScoreTables';

/** 열 제목(번역됨). */
export interface HeadlineColumnText {
    readonly target: string;
    readonly diff: string;
    readonly ci: string;
    readonly p: string;
    readonly n: string;
    readonly reading: string;
}

interface Props {
    readonly caption: string;
    readonly columns: HeadlineColumnText;
    readonly rows: readonly BenchmarkHeadlineRow[];
    /** 해석 이름(번역됨). */
    readonly verdictText: Readonly<
        Record<BenchmarkHeadlineRow['verdict'], string>
    >;
}

/** 오른쪽 정렬하는 수치 열. 대상·해석 열은 왼쪽 정렬이다. */
const NUMERIC_COLUMNS = ['diff', 'ci', 'p', 'n'] as const;

/** 주체 대 대상 비교 한 묶음(경쟁 모델 또는 기준선). */
export function HeadlineContrastTable({
    caption,
    columns,
    rows,
    verdictText,
}: Props) {
    return (
        <BenchmarkTableShell caption={caption}>
            <thead>
                <tr>
                    <th scope="col" className={BENCHMARK_TH}>
                        {columns.target}
                    </th>
                    {NUMERIC_COLUMNS.map(column => (
                        <th
                            key={column}
                            scope="col"
                            className={cn(BENCHMARK_TH, 'text-right')}
                        >
                            {columns[column]}
                        </th>
                    ))}
                    <th scope="col" className={BENCHMARK_TH}>
                        {columns.reading}
                    </th>
                </tr>
            </thead>
            <tbody>
                {rows.map(row => (
                    <tr key={row.id} className={BENCHMARK_ROW}>
                        <th
                            scope="row"
                            className="px-3 py-2 font-normal text-secondary-100"
                            translate="no"
                        >
                            {row.label}
                        </th>
                        <td className="px-3 py-2 text-right font-semibold text-secondary-50">
                            {row.diffText}
                        </td>
                        <td className="px-3 py-2 text-right whitespace-nowrap text-secondary-300">
                            {row.ciText}
                        </td>
                        <td className="px-3 py-2 text-right text-secondary-300">
                            {row.pText}
                        </td>
                        <td className="px-3 py-2 text-right text-secondary-300">
                            {row.n}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-secondary-200">
                            {verdictText[row.verdict]}
                        </td>
                    </tr>
                ))}
            </tbody>
        </BenchmarkTableShell>
    );
}
