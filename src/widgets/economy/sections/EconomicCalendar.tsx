import type {
    CalendarImpact,
    EconomicCalendarEvent,
} from '@y0ngha/siglens-core';

import { cn } from '@/shared/lib/cn';

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
    High: 'bg-danger-700 text-danger-100',
    Medium: 'bg-warning-700 text-warning-100',
    Low: 'bg-secondary-700 text-secondary-200',
};

const NUMBER_FORMATTER = new Intl.NumberFormat('ko-KR');

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
                    {events.map((e, i) => (
                        <CalendarRow
                            key={`${e.date}:${e.event}:${i}`}
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

/**
 * FMP가 보내는 'YYYY-MM-DD HH:mm:ss'를 HTML `<time dateTime>`이 인식하는 ISO-8601
 * 형식으로 정규화한다. 원본은 ET 기준 시각이지만, 표준 표기로만 변환해
 * (timezone offset 부여는 core 정규화 영역) 크롤러·screen reader가 파싱할 수 있게 한다.
 */
function toIsoDateTime(date: string): string {
    return date.replace(' ', 'T');
}

function formatNum(v: number | null, unit: string): string {
    if (v === null) return 'N/A';
    return `${NUMBER_FORMATTER.format(v)}${unit}`;
}
