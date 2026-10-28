'use client';

/**
 * 선택한 날의 상세 패널 — 날짜 제목과 그날 이벤트 목록. 활성 중요도 이벤트가 없으면 안내 문구.
 *
 * SSR 크롤러 접근성: 모든 패널을 조건부 렌더 대신 DOM에 항상 두고 비선택 패널에 `hidden`을
 * 준다 — 비선택 패널도 HTML에 남아 전체 이벤트가 색인되고, `hidden`은 a11y 트리에서 빠지므로
 * 스크린 리더는 선택된 패널만 읽는다.
 *
 * ARIA: 토글 버튼(`aria-pressed`) + `aria-labelledby`로 버튼-패널을 잇는다. `role="tabpanel"`은
 * `role="tab"`/`tablist` 없이 쓰면 고아 ARIA라 쓰지 않는다.
 */
import { useTranslations } from 'next-intl';
import type { CalendarImpact } from '@y0ngha/siglens-core';
import { useCurrentLocale } from '@/shared/i18n/LocaleContext';
import { cn } from '@/shared/lib/cn';
import type { DayGroup } from '../../model/calendarTypes';
import { visibleEventsOf } from '../../utils/calendarGrouping';
import { kstDayOfWeekLabel, monthLabel } from '../../utils/calendarLabels';
import { DayEventItem } from './DayEventItem';

interface DayDetailPanelProps {
    group: DayGroup;
    isSelected: boolean;
    activeImpacts: ReadonlySet<CalendarImpact>;
    labels: Record<string, string>;
}

/** 날짜 제목과 이벤트 목록을 그린다. 선택된 패널에서만 빈 필터 안내를 띄운다. */
export function DayDetailPanel({
    group,
    isSelected,
    activeImpacts,
    labels,
}: DayDetailPanelProps) {
    const t = useTranslations('widgets.economy');
    const locale = useCurrentLocale();
    const { month, day, dateKey } = group;
    const hasVisibleEvents = visibleEventsOf(group, activeImpacts).length > 0;

    return (
        <div
            id={`panel-${dateKey}`}
            aria-labelledby={`day-btn-${dateKey}`}
            hidden={!isSelected}
            className={cn(
                'space-y-3 transition-opacity motion-reduce:transition-none',
                isSelected ? 'opacity-100' : 'opacity-0'
            )}
        >
            <h3 className="font-semibold text-secondary-100">
                {/* 월은 로케일 월 이름으로 넘긴다 — 번역된 템플릿에 숫자를 꽂으면 영어에서
                    `9 15 (Wed`가 된다. 닫는 괄호도 메시지 안에 있다. */}
                {t('EconomicCalendarGrid.dc712b', {
                    v0: monthLabel(locale, month),
                    v1: day,
                    v2: kstDayOfWeekLabel(dateKey, locale),
                })}
            </h3>
            {/* 비선택(hidden) 패널에는 넣지 않는다 — 크롤러가 이벤트 목록 옆에서 "일정 없음"을 함께 색인한다. */}
            {isSelected && !hasVisibleEvents && (
                <p className="text-sm text-secondary-400">
                    {t('EconomicCalendarGrid.noVisibleEvents')}
                </p>
            )}
            <ul className="space-y-2">
                {group.events.map(ev => (
                    <DayEventItem
                        key={`${ev.iso}:${ev.original.event}:${ev.original.actual ?? ''}`}
                        event={ev}
                        hidden={!activeImpacts.has(ev.original.impact)}
                        labels={labels}
                    />
                ))}
            </ul>
        </div>
    );
}
