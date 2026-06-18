import type {
    CalendarImpact,
    EconomicCalendarEvent,
} from '@y0ngha/siglens-core';

import { cn } from '@/shared/lib/cn';
import { formatNum } from '@/shared/lib/formatNum';

import { toIsoDateTime } from '../utils/etTimeUtils';

interface EconomicCalendarProps {
    events: readonly EconomicCalendarEvent[];
}

interface CalendarRowProps {
    event: EconomicCalendarEvent;
}

const IMPACT_LABELS: Record<CalendarImpact, string> = {
    High: '높음',
    Medium: '보통',
    Low: '낮음',
};

const IMPACT_BADGE: Record<CalendarImpact, string> = {
    High: 'bg-ui-danger/20 text-ui-danger',
    Medium: 'bg-ui-warning/20 text-ui-warning',
    Low: 'bg-secondary-700 text-secondary-200',
};

/** US 경제 캘린더 — 다가오는 발표 이벤트를 표로 렌더(SSR 텍스트). */
export function EconomicCalendar({ events }: EconomicCalendarProps) {
    return (
        <section aria-labelledby="economy-calendar-heading">
            <h2
                id="economy-calendar-heading"
                className="text-secondary-100 mb-3 text-xl font-semibold"
            >
                경제 캘린더
            </h2>
            {events.length === 0 ? (
                <p className="text-secondary-400 text-sm">
                    다가오는 미국 경제 발표 일정이 아직 없어요.
                </p>
            ) : (
                <ul className="border-secondary-700 divide-secondary-800 divide-y rounded-xl border">
                    {events.map(e => (
                        // `actual`을 키에 포함해 같은 datetime·event라도 결과 값이
                        // 다르면(예: 실시간 업데이트 전후 두 레코드가 공존) 충돌이 없다.
                        // 여전히 정량 검증된 unique 불변은 아니므로 core normalize 단계에
                        // dedup 패스가 추가되면 이 키는 단순화할 수 있다.
                        <CalendarRow
                            key={`${e.date}:${e.event}:${e.actual ?? ''}`}
                            event={e}
                        />
                    ))}
                </ul>
            )}
        </section>
    );
}

function CalendarRow({ event }: CalendarRowProps) {
    return (
        <li className="grid grid-cols-1 gap-2 px-4 py-3 sm:grid-cols-[10rem_1fr_5rem]">
            <time
                className="text-secondary-300 text-sm"
                dateTime={toIsoDateTime(event.date)}
            >
                {event.date}
            </time>
            <div>
                <p className="text-secondary-100">{event.event}</p>
                <p className="text-secondary-400 text-xs">
                    예상 {formatNum(event.estimate, event.unit)} · 이전{' '}
                    {formatNum(event.previous, event.unit)}
                    {event.actual !== null && (
                        <> · 실제 {formatNum(event.actual, event.unit)}</>
                    )}
                </p>
            </div>
            <span
                className={cn(
                    'h-fit justify-self-start rounded-full px-2 py-0.5 text-xs font-medium sm:justify-self-end',
                    IMPACT_BADGE[event.impact]
                )}
            >
                {IMPACT_LABELS[event.impact]}
            </span>
        </li>
    );
}
