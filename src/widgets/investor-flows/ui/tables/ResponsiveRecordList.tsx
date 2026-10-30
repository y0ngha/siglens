/**
 * 같은 기록 목록을 좁은 화면은 카드로, 넓은 화면은 표로 보여 주는 틀.
 */
import type { ReactNode } from 'react';
import { cn } from '@/shared/lib/cn';

/** 표 머리글 한 칸 — 글자 정렬만 고른다(칸 안쪽 여백은 위치로 정해진다). */
export interface RecordColumn {
    readonly label: string;
    readonly align: 'left' | 'right';
}

const ALIGN_CLASS: Record<RecordColumn['align'], string> = {
    left: 'text-left',
    right: 'text-right',
};

/** 양 끝 칸은 바깥 여백을 없애고, 가운데 칸은 좌우 여백을 준다. */
function paddingClass(index: number, lastIndex: number): string {
    if (index === 0) return 'py-2 pr-3';
    if (index === lastIndex) return 'py-2 pl-3';
    return 'px-3 py-2';
}

interface ResponsiveRecordListProps {
    /** 표 캡션(스크린 리더용). */
    readonly caption: string;
    readonly columns: readonly RecordColumn[];
    /** 좁은 화면의 카드 `<li>`들. */
    readonly cards: ReactNode;
    /** 넓은 화면의 표 본문 `<tr>`들. */
    readonly rows: ReactNode;
}

/**
 * 가로 스크롤 표를 쓰지 않는다 — 두 표현을 모두 렌더하고 CSS로 가르는데, 보조기기에는 `hidden`인 쪽이 숨겨져 한 번만 읽힌다.
 */
export function ResponsiveRecordList({
    caption,
    columns,
    cards,
    rows,
}: ResponsiveRecordListProps) {
    const lastIndex = columns.length - 1;
    return (
        <>
            <ul className="space-y-2 md:hidden">{cards}</ul>
            <div className="hidden md:block">
                <table className="w-full text-sm">
                    <caption className="sr-only">{caption}</caption>
                    <thead>
                        <tr className="border-b border-secondary-700 text-xs text-secondary-400">
                            {columns.map((column, index) => (
                                <th
                                    key={column.label}
                                    scope="col"
                                    className={cn(
                                        'font-medium',
                                        paddingClass(index, lastIndex),
                                        ALIGN_CLASS[column.align]
                                    )}
                                >
                                    {column.label}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>{rows}</tbody>
                </table>
            </div>
        </>
    );
}
