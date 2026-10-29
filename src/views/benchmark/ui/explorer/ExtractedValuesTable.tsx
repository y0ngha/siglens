'use client';

/**
 * 답변 한 회차에서 추출기가 뽑은 값과 그 판정 표.
 */
import { useTranslations } from 'next-intl';
import type { BenchmarkExtractedValue } from '@/entities/benchmark/types';
import { BENCHMARK_EMPTY_CELL } from '@/shared/lib/benchmarkFormat';
import { useBenchmarkEnumText } from '../../hooks/useBenchmarkEnumText';
import { BenchmarkVerdictChip } from './BenchmarkVerdictChip';

interface Props {
    readonly values: readonly BenchmarkExtractedValue[];
    /**
     * 표가 속한 대상·회차(예: "AlphaAI 2회차"). 펼친 문항 하나에 이 표가 대상 × 회차만큼
     * 놓이므로, 영역 이름에 붙여 랜드마크 목록에서 서로 구분되게 한다.
     */
    readonly context: string;
}

/** 열 제목 칸 공통 클래스. 마지막 열만 오른쪽 여백이 없다. */
const COLUMN_HEADERS = [
    { key: 'part', className: 'py-1 pr-3 font-semibold' },
    { key: 'value', className: 'py-1 pr-3 font-semibold' },
    { key: 'verdict', className: 'py-1 pr-3 font-semibold' },
    { key: 'reason', className: 'py-1 font-semibold' },
] as const;

/**
 * 부분(행) × 값·판정·근거. 좁은 화면에서 가로로 스크롤되는 표라, 키보드로 닿도록 캡션
 * 이름의 `region` + `tabIndex={0}`을 둔다(WCAG 2.1.1).
 */
export function ExtractedValuesTable({ values, context }: Props) {
    const t = useTranslations('views.benchmark.explorer.detail');
    const { label: labelText } = useBenchmarkEnumText();
    const columnText = {
        part: t('part'),
        value: t('value'),
        verdict: t('verdict'),
        reason: t('reason'),
    } as const;
    const caption = t('extracted');
    return (
        <div
            role="region"
            aria-label={`${context} ${caption}`}
            tabIndex={0}
            className="mt-3 overflow-x-auto rounded focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
        >
            <table className="w-full min-w-[28rem] text-left text-xs">
                <caption className="pb-1 text-left text-secondary-400">
                    {caption}
                </caption>
                <thead>
                    <tr className="text-secondary-400">
                        {COLUMN_HEADERS.map(column => (
                            <th
                                key={column.key}
                                scope="col"
                                className={column.className}
                            >
                                {columnText[column.key]}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className="text-secondary-200">
                    {values.map(extracted => (
                        <tr
                            key={extracted.part}
                            className="border-t border-secondary-700 align-top"
                        >
                            <th
                                scope="row"
                                className="py-1.5 pr-3 font-normal"
                                lang="ko"
                            >
                                {extracted.part}
                            </th>
                            <td className="py-1.5 pr-3 tabular-nums">
                                {extracted.value ?? BENCHMARK_EMPTY_CELL}
                            </td>
                            <td className="py-1.5 pr-3">
                                <BenchmarkVerdictChip
                                    label={extracted.verdict}
                                    text={labelText[extracted.verdict]}
                                />
                            </td>
                            <td className="py-1.5" lang="ko">
                                {extracted.reason ?? BENCHMARK_EMPTY_CELL}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
