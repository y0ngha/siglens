'use client';

/**
 * 월 그리드의 한 칸 — 그 달 밖의 패딩, 이벤트 없는 날(숫자만), 이벤트 있는 날(선택 버튼) 중 하나.
 */
import type { CalendarImpact } from '@y0ngha/siglens-core';
import type { MonthDay } from '../../model/calendarTypes';
import { DayCell } from './DayCell';
import { EmptyDayCell } from './EmptyDayCell';

interface MonthCellProps {
    /** `null`이면 그 달 밖의 앞뒤 패딩 칸. */
    cell: MonthDay | null;
    selectedDateKey: string;
    todayKey: string;
    activeImpacts: ReadonlySet<CalendarImpact>;
    onSelect: (dateKey: string) => void;
    labels: Record<string, string>;
}

/** 칸 데이터로 세 가지 칸 중 하나를 고른다. */
export function MonthCell({
    cell,
    selectedDateKey,
    todayKey,
    activeImpacts,
    onSelect,
    labels,
}: MonthCellProps) {
    if (cell === null) return <td aria-hidden="true" className="p-0.5" />;
    const isToday = cell.dateKey === todayKey;
    if (cell.group === null)
        return <EmptyDayCell day={cell.day} isToday={isToday} />;
    return (
        <DayCell
            group={cell.group}
            isSelected={selectedDateKey === cell.dateKey}
            isToday={isToday}
            activeImpacts={activeImpacts}
            onSelect={onSelect}
            labels={labels}
        />
    );
}
