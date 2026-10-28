'use client';

/**
 * 경제 캘린더 — 한국시간 기준 월 그리드와 날짜별 상세 패널, 중요도 필터를 배치하는 오케스트레이터.
 * 그룹핑·그리드 계산은 `utils/calendarGrouping`, 선택·필터 상태는 `hooks/`, 칸·패널 렌더는
 * `sections/calendar/`가 맡는다.
 */
import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { CalendarCountry } from '@/entities/economy/model';
import { useCurrentLocale } from '@/shared/i18n/LocaleContext';
import { cn } from '@/shared/lib/cn';
import { SURFACE_CARD } from '@/shared/lib/surfaceStyles';
import { useCalendarCountryLabel } from '../hooks/useCalendarCountryLabel';
import { useCalendarSelection } from '../hooks/useCalendarSelection';
import { useEconomicCalendarTrigger } from '../hooks/useEconomicCalendarTrigger';
import { useImpactFilter } from '../hooks/useImpactFilter';
import { useIndicatorTranslationTrigger } from '../hooks/useIndicatorTranslationTrigger';
import type { CalendarGridEvent, DayGroup } from '../model/calendarTypes';
import {
    buildMonthViews,
    buildMonthWeeks,
    groupEventsByKstDay,
    spannedMonths,
} from '../utils/calendarGrouping';
import {
    CalendarHeading,
    CALENDAR_HEADING_ID,
} from './calendar/CalendarHeading';
import { DayDetailPanel } from './calendar/DayDetailPanel';
import { MonthCalendar } from './calendar/MonthCalendar';
import { ImpactFilter } from './ImpactFilter';

interface EconomicCalendarGridProps {
    events: readonly CalendarGridEvent[];
    /**
     * 기본 선택 기준일 — KST 'YYYY-MM-DD'. 서버 RSC가 ET-오늘 instant를 KST 날짜키로 1회
     * 변환해 주입한다(ISR 안전). 생략 시 가장 이른 그룹을 기본 선택한다.
     */
    today?: string;
    /**
     * raw 이벤트명 → 표시 레이블(한국어 우선) 맵. 서버 RSC가 `resolveIndicatorLabels`로 미리
     * 해결해 주입한다. 생략 시 모든 이벤트가 영어 원문으로 표시된다.
     */
    labels?: Record<string, string>;
    /**
     * 어느 나라 캘린더인가. 마운트 시 도는 인제스션 트리거가 이 값으로 갈린다 — 기본값을 두지
     * 않는 것은 의도다. 한국 라우트에서 빠뜨리면 미국 이벤트만 계속 수집되고 한국 캘린더는
     * 영원히 비는데, 화면에는 아무 표시가 없다.
     */
    country: CalendarCountry;
}

const NO_LABELS: Record<string, string> = {};

/**
 * 모든 날짜의 상세 패널을 DOM에 렌더하고(`hidden`으로 비선택 숨김) SSR 크롤러가 전체 이벤트를
 * 색인하게 한다. 중요도 필터는 셀 건수·점·미리보기만 시각적으로 한정한다.
 *
 * 패널 묶음에 live region을 두지 않는다 — 기본 선택이 마운트 후 effect로 정해져 스크린 리더가
 * 누르지도 않은 날의 패널 전체를 읽었다. 선택은 `aria-pressed` 버튼과 `aria-controls`로 전달된다.
 */
export function EconomicCalendarGrid({
    events,
    today = '',
    labels = NO_LABELS,
    country,
}: EconomicCalendarGridProps) {
    const t = useTranslations('widgets.economy');
    const locale = useCurrentLocale();
    const countryLabel = useCalendarCountryLabel(country);
    const [showPast, setShowPast] = useState(false);
    const { activeImpacts, toggleImpact } = useImpactFilter();
    useEconomicCalendarTrigger(country);
    useIndicatorTranslationTrigger(events, labels);

    const groups = useMemo(
        () => groupEventsByKstDay(events, locale),
        [events, locale]
    );
    const monthWeeks = useMemo(() => {
        const groupMap = new Map<string, DayGroup>(
            groups.map(g => [g.dateKey, g])
        );
        return spannedMonths(groups).map(({ year, month }) => ({
            year,
            month,
            weeks: buildMonthWeeks(year, month, groupMap),
        }));
    }, [groups]);

    const { selectedDateKey, todayKey, selectDate } = useCalendarSelection({
        groups,
        today,
        activeImpacts,
    });
    const monthViews = buildMonthViews({
        monthWeeks,
        groups,
        todayKey,
        selectedDateKey,
    });
    const hasPastWeeks = monthViews.some(({ weeks }) =>
        weeks.some(week => week.isPast)
    );

    if (events.length === 0) {
        return (
            <section aria-labelledby={CALENDAR_HEADING_ID}>
                <div className="mb-3">
                    <CalendarHeading />
                </div>
                <p className="text-sm text-secondary-400">
                    {t('EconomicCalendarGrid.f9d9dc', { v0: countryLabel })}
                </p>
            </section>
        );
    }

    return (
        <section aria-labelledby={CALENDAR_HEADING_ID}>
            <div className="mb-4">
                <CalendarHeading />
            </div>

            <div className="mb-3">
                <ImpactFilter value={activeImpacts} onToggle={toggleImpact} />
            </div>

            <div className={cn(SURFACE_CARD, 'flex flex-col gap-6 p-3 sm:p-4')}>
                {hasPastWeeks && (
                    <button
                        type="button"
                        aria-expanded={showPast}
                        onClick={() => setShowPast(prev => !prev)}
                        className="inline-flex min-h-11 touch-manipulation items-center self-start rounded-full border border-border-control px-3 py-1.5 text-sm font-medium text-secondary-300 transition-colors hover:text-secondary-100 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none motion-reduce:transition-none"
                    >
                        {showPast
                            ? t('EconomicCalendarGrid.pastCollapse')
                            : t('EconomicCalendarGrid.pastExpand')}
                    </button>
                )}
                {monthViews.map(view => (
                    <MonthCalendar
                        key={`${view.year}-${view.month}`}
                        view={view}
                        selectedDateKey={selectedDateKey}
                        todayKey={todayKey}
                        showPast={showPast}
                        activeImpacts={activeImpacts}
                        onSelect={selectDate}
                        labels={labels}
                    />
                ))}
            </div>

            <div className="mt-4 space-y-0">
                {groups.map(group => (
                    <DayDetailPanel
                        key={group.dateKey}
                        group={group}
                        isSelected={group.dateKey === selectedDateKey}
                        activeImpacts={activeImpacts}
                        labels={labels}
                    />
                ))}
            </div>
        </section>
    );
}
