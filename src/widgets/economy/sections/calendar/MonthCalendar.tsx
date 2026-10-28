'use client';

/**
 * 한 달 월 그리드 표 — 캡션·요일 헤더와 주별 칸(이벤트 있는 날은 선택 버튼, 없는 날은 숫자).
 * 지난 주는 펼치기 전까지 `hidden`이고, 달 전체가 지난 주뿐이면 제목·요일 줄까지 숨긴다.
 */
import { useTranslations } from 'next-intl';
import type { CalendarImpact } from '@y0ngha/siglens-core';
import { useCurrentLocale } from '@/shared/i18n/LocaleContext';
import type { MonthView } from '../../model/calendarTypes';
import { monthLabel, weekdayLabels } from '../../utils/calendarLabels';
import { DayCell } from './DayCell';
import { EmptyDayCell } from './EmptyDayCell';

interface MonthCalendarProps {
    view: MonthView;
    selectedDateKey: string;
    todayKey: string;
    /** 지난 주를 펼쳤는가. */
    showPast: boolean;
    activeImpacts: ReadonlySet<CalendarImpact>;
    onSelect: (dateKey: string) => void;
    labels: Record<string, string>;
}

/** 한 달 표를 그린다 — 칸 종류(이벤트 있음·없음·패딩)는 셀 데이터로 고른다. */
export function MonthCalendar({
    view: { year, month, weeks },
    selectedDateKey,
    todayKey,
    showPast,
    activeImpacts,
    onSelect,
    labels,
}: MonthCalendarProps) {
    const t = useTranslations('widgets.economy');
    const locale = useCurrentLocale();
    const captionText = t('EconomicCalendarGrid.490b3a', {
        v0: year,
        v1: monthLabel(locale, month),
    });
    const isMonthHidden = !showPast && weeks.every(week => week.isPast);

    return (
        <div hidden={isMonthHidden}>
            <p
                className="mb-2 text-sm font-medium text-secondary-300"
                aria-hidden="true"
            >
                {captionText}
            </p>
            <table className="w-full table-fixed border-collapse">
                <caption className="sr-only">{captionText}</caption>
                <thead>
                    <tr>
                        {weekdayLabels(locale).map(label => (
                            <th
                                key={label}
                                scope="col"
                                className="py-1 text-center text-xs font-medium text-secondary-400"
                            >
                                {label}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {weeks.map(({ cells, isPast }, wi) => (
                        <tr key={wi} hidden={isPast && !showPast}>
                            {cells.map((cell, ci) =>
                                cell === null ? (
                                    <td
                                        key={`empty-${wi}-${ci}`}
                                        aria-hidden="true"
                                        className="p-0.5"
                                    />
                                ) : cell.group !== null ? (
                                    <DayCell
                                        key={cell.dateKey}
                                        group={cell.group}
                                        isSelected={
                                            selectedDateKey === cell.dateKey
                                        }
                                        isToday={cell.dateKey === todayKey}
                                        activeImpacts={activeImpacts}
                                        onSelect={onSelect}
                                        labels={labels}
                                    />
                                ) : (
                                    <EmptyDayCell
                                        key={cell.dateKey}
                                        day={cell.day}
                                        isToday={cell.dateKey === todayKey}
                                    />
                                )
                            )}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
