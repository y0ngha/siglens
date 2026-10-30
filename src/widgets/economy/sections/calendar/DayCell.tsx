'use client';

/**
 * 이벤트가 있는 날의 월 그리드 칸 — 날짜·중요도 점·건수·인라인 미리보기를 담은 선택 버튼.
 */
import { useTranslations } from 'next-intl';
import { useMemo } from 'react';
import type { CalendarImpact } from '@y0ngha/siglens-core';
import { cn } from '@/shared/lib/cn';
import type { DayGroup } from '../../model/calendarTypes';
import { visibleEventsOf } from '../../utils/calendarGrouping';
import { displayEventLabel } from '../../utils/calendarLabels';
import { IMPACT_LABEL_KEY, IMPACT_ORDER } from '../../utils/impactMeta';

/** 임팩트 점 색상 — 장식용(aria-hidden). */
const IMPACT_DOT: Record<CalendarImpact, string> = {
    High: 'bg-ui-danger',
    Medium: 'bg-ui-warning',
    Low: 'bg-secondary-400',
};

/** 인라인 이벤트 미리보기 최대 표시 건수(sm 이상 화면). */
const INLINE_EVENT_MAX = 2;

interface DayCellProps {
    group: DayGroup;
    isSelected: boolean;
    /** 오늘(KST) 칸 — `aria-current="date"`와 옅은 링으로 표시한다. */
    isToday: boolean;
    activeImpacts: ReadonlySet<CalendarImpact>;
    onSelect: (dateKey: string) => void;
    labels: Record<string, string>;
}

/** 그날 활성 중요도 이벤트의 점·건수·미리보기를 그리고, 누르면 그날을 선택한다. */
export function DayCell({
    group,
    isSelected,
    isToday,
    activeImpacts,
    onSelect,
    labels,
}: DayCellProps) {
    const t = useTranslations('widgets.economy');
    const tLabel = useTranslations('shared.enumLabel');
    const { day, month, dateKey } = group;

    // 셀의 점·건수·미리보기는 활성 중요도만 센다(전체 텍스트는 상세 패널이 DOM에 보유).
    // 같은 날 High가 여러 건이어도 점은 하나 — 점 순서는 High → Medium → Low.
    const { visibleEvents, dots } = useMemo(() => {
        const visibleEvents = visibleEventsOf(group, activeImpacts);
        const impactSet = new Set(visibleEvents.map(e => e.original.impact));
        return {
            visibleEvents,
            dots: IMPACT_ORDER.filter(i => impactSet.has(i)),
        };
    }, [group, activeImpacts]);
    const count = visibleEvents.length;

    return (
        <td className="p-0.5 align-top">
            <button
                id={`day-btn-${dateKey}`}
                type="button"
                /*
                 * 심각도를 라벨에 담는다. 셀에서 심각도를 나르는 것은 6px 점의 **색뿐**이고
                 * 빨강/주황은 적록색약에서 수렴한다(WCAG 1.4.1). 6px에서는 모양·링으로
                 * 갈라도 읽히지 않으므로 텍스트로 낸다.
                 */
                aria-label={
                    // 문장 하나를 통째로 고른다 — 조각을 이어 붙이면 로케일마다 어순을 맞출 수 없다.
                    dots.length === 0
                        ? t('dayCellAria', {
                              v0: month + 1,
                              v1: day,
                              v2: count,
                          })
                        : t('dayCellAriaWithImpacts', {
                              v0: month + 1,
                              v1: day,
                              v2: count,
                              v3: dots
                                  .map(impact =>
                                      tLabel(IMPACT_LABEL_KEY[impact])
                                  )
                                  .join(', '),
                          })
                }
                aria-pressed={isSelected}
                aria-current={isToday ? 'date' : undefined}
                aria-controls={`panel-${dateKey}`}
                onClick={() => onSelect(dateKey)}
                className={cn(
                    'relative min-h-[4rem] w-full rounded-lg p-1 text-left text-xs transition-colors',
                    /* `ring-offset`이 있어야 **선택된 날**에서도 포커스가 보인다 — 선택 표시가
                       이미 `ring-primary-500 ring-2`라 같은 값이면 focus 전후가 같아진다. */
                    'focus-visible:ring-primary-500 focus-visible:ring-offset-secondary-900 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none',
                    'motion-reduce:transition-none',
                    isSelected
                        ? 'bg-primary-900/30 ring-primary-500 ring-2'
                        : 'hover:bg-secondary-700/40',
                    // 선택 링이 있으면 오늘 링은 얹지 않는다 — 겹치면 서로 덮어 흐려진다.
                    isToday && !isSelected && 'ring-secondary-500 ring-1'
                )}
            >
                <span
                    className={cn(
                        'block text-right text-xs leading-none tabular-nums',
                        isSelected
                            ? 'text-primary-400 font-semibold'
                            : 'text-secondary-200 font-medium',
                        isToday && 'font-bold'
                    )}
                >
                    {day}
                </span>

                {/* 점은 장식이다 — 심각도는 위 `aria-label`이 나른다. */}
                <span
                    aria-hidden="true"
                    className="mt-1 flex flex-wrap gap-0.5"
                >
                    {dots.map(impact => (
                        <span
                            key={impact}
                            className={cn(
                                'inline-block h-1.5 w-1.5 rounded-full',
                                IMPACT_DOT[impact]
                            )}
                        />
                    ))}
                </span>

                <span className="mt-0.5 block text-xs text-secondary-300 tabular-nums">
                    {t('EconomicCalendarGrid.703910', { v0: count })}
                </span>

                <span className="mt-1 hidden space-y-0.5 sm:block">
                    {visibleEvents.slice(0, INLINE_EVENT_MAX).map(ev => (
                        <span
                            // 상세 패널과 같은 key 구성 — 같은 시각·이름 행이 둘이어도 겹치지 않게.
                            key={`${ev.iso}:${ev.original.event}:${ev.original.actual ?? ''}`}
                            className="block min-w-0 truncate text-xs leading-tight text-secondary-400"
                        >
                            {ev.inlineTimeLabel}{' '}
                            {displayEventLabel(ev.original.event, labels)}
                        </span>
                    ))}
                    {count > INLINE_EVENT_MAX && (
                        <span className="block text-xs text-secondary-500">
                            +{count - INLINE_EVENT_MAX}
                        </span>
                    )}
                </span>
            </button>
        </td>
    );
}
