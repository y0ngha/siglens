import type { ReactNode } from 'react';
import { cn } from '@/shared/lib/cn';
import { CHAT_CHART_FRAME_CLASS } from '../ChatChartPlaceholder';
import { VISUAL_TABLE_ROW_CLASS } from './ChatVisualPlaceholder';

/** 데이터 표 — 머리글 한 줄과 행들. 칸은 이미 서식을 입힌 글자다. */
export interface VisualTable {
    head: readonly string[];
    rows: readonly (readonly string[])[];
}

/** 범례 한 항목 — 색칩(`fillClass`)과 글자. */
export interface LegendItem {
    id: string;
    label: string;
    swatchClass: string;
}

interface VisualBlockFrameProps {
    title: string;
    /** 스크린 리더용 요약 — 그림의 핵심 수치를 한 문장으로. */
    ariaLabel: string;
    tableLabel: string;
    table: VisualTable;
    legend?: readonly LegendItem[];
    /** 기준 시각 글자(이미 서식을 입힌 한 줄). */
    asOfText: string;
    children: ReactNode;
}

/**
 * 시각화 블록의 공통 틀 — 고정 높이 카드(`CHAT_CHART_FRAME_CLASS`, 캔들 차트·자리 표시와 같다) 안에 제목·범례·그림을
 * 놓고, 카드 아래에 접힌 `<details>` 데이터 표를 둔다. 그림 영역은 `role="img"` + 요약 `aria-label`이고(안쪽 그래픽은
 * 숨긴다), 정확한 값은 표로 읽는다. 표 줄 높이는 고정이라 접힌 상태의 높이가 자리 표시와 같다.
 */
export function VisualBlockFrame({
    title,
    ariaLabel,
    tableLabel,
    table,
    legend = [],
    asOfText,
    children,
}: VisualBlockFrameProps) {
    return (
        <figure data-testid="chat-visual-block" className="my-3">
            <div
                className={cn(CHAT_CHART_FRAME_CLASS, 'my-0 flex flex-col p-3')}
            >
                <figcaption className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-xs font-medium text-secondary-200">
                        {title}
                    </span>
                    <span className="shrink-0 text-[10px] text-secondary-400">
                        {asOfText}
                    </span>
                </figcaption>
                {legend.length === 0 ? null : (
                    <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-secondary-300">
                        {legend.map(item => (
                            <li
                                key={item.id}
                                className="flex items-center gap-1"
                            >
                                <span
                                    aria-hidden="true"
                                    className={cn(
                                        'inline-block size-2 rounded-sm',
                                        item.swatchClass
                                    )}
                                />
                                {item.label}
                            </li>
                        ))}
                    </ul>
                )}
                <div
                    role="img"
                    aria-label={ariaLabel}
                    className="mt-2 min-h-0 flex-1"
                >
                    {children}
                </div>
            </div>
            <details className="text-xs text-secondary-300">
                <summary
                    className={cn(
                        VISUAL_TABLE_ROW_CLASS,
                        'flex cursor-pointer items-center'
                    )}
                >
                    {tableLabel}
                </summary>
                <div className="max-h-64 overflow-auto">
                    <table className="w-full min-w-max border-collapse text-left">
                        <thead>
                            <tr>
                                {table.head.map(h => (
                                    <th
                                        key={h}
                                        scope="col"
                                        className="px-2 py-1 font-medium text-secondary-200"
                                    >
                                        {h}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {table.rows.map(row => (
                                <tr key={row.join('|')}>
                                    {row.map((cell, i) => (
                                        <td
                                            key={table.head[i] ?? i}
                                            className="px-2 py-1 tabular-nums"
                                        >
                                            {cell}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </details>
        </figure>
    );
}
