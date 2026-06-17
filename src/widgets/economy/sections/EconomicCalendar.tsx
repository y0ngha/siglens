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
    High: 'bg-ui-danger/20 text-ui-danger',
    Medium: 'bg-ui-warning/20 text-ui-warning',
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

/**
 * ET(Eastern Time) UTC 오프셋을 반환한다.
 *
 * DST 전환 규칙(IANA America/New_York):
 * - EDT: 3월 두 번째 일요일 02:00 ~ 11월 첫 번째 일요일 02:00 → UTC-4
 * - EST: 그 외 구간 → UTC-5
 *
 * `Intl.DateTimeFormat`을 쓰지 않고 ECMAScript 규칙으로 직접 계산해 서버사이드에서도
 * 일관되게 동작한다.
 */
function getEtOffset(date: Date): '-04:00' | '-05:00' {
    const year = date.getUTCFullYear();

    /**
     * n번째 일요일(1-indexed)의 UTC ms를 반환한다.
     * DST 전환은 지역 시각 02:00에 발생하므로 UTC로는 +5h(EST 겨울) 또는 +4h(EDT 여름)
     * 을 더해야 한다. 전환 방향(EST→EDT, EDT→EST)별 보정을 위해 각 경계에서의
     * 기준 offset을 사용한다.
     *
     * 단순화: 두 전환 모두 UTC 07:00 기준으로 판단한다 — EST 02:00 = UTC 07:00.
     */
    function nthSundayUtcMs(
        month: number,
        nth: number,
        baseYear: number
    ): number {
        // month는 0-indexed
        const firstDay = new Date(Date.UTC(baseYear, month, 1));
        const firstSunday = (7 - firstDay.getUTCDay()) % 7;
        const day = 1 + firstSunday + (nth - 1) * 7;
        return Date.UTC(baseYear, month, day, 7, 0, 0);
    }

    const edtStart = nthSundayUtcMs(2, 2, year); // 3월 두 번째 일요일
    const edtEnd = nthSundayUtcMs(10, 1, year); // 11월 첫 번째 일요일
    const ts = date.getTime();

    return ts >= edtStart && ts < edtEnd ? '-04:00' : '-05:00';
}

/**
 * FMP가 보내는 'YYYY-MM-DD HH:mm:ss'를 HTML `<time dateTime>`이 인식하는 ISO-8601
 * 형식으로 정규화한다. FMP 원본은 ET 기준 시각이므로 DST를 고려한 ET offset을 부여해
 * 크롤러·screen reader가 정확한 절대 시각을 파싱할 수 있게 한다.
 */
function toIsoDateTime(date: string): string {
    const iso = date.replace(' ', 'T');
    const parsed = new Date(`${iso}Z`); // UTC로 일시 파싱해 offset 계산에 사용
    const offset = getEtOffset(parsed);
    return `${iso}${offset}`;
}

function formatNum(v: number | null, unit: string): string {
    if (v === null) return 'N/A';
    return `${NUMBER_FORMATTER.format(v)}${unit}`;
}
