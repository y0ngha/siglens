import type { EconomicCalendarEvent } from '@y0ngha/siglens-core';

import { addUtcIsoDays } from '@/shared/lib/isoDate';

import { economicCalendarId } from './economicCalendarId';
import {
    CALENDAR_INGESTION_WINDOW_DAYS,
    CALENDAR_PAST_WINDOW_DAYS,
    CALENDAR_RECENT_PAST_DAYS,
    type CalendarCountry,
} from './economyCalendarConstants';

/** 양끝 포함 'YYYY-MM-DD' 구간 — FMP economic-calendar의 `from`/`to`. */
export interface CalendarDateRange {
    readonly from: string;
    readonly to: string;
}

/** 한 번의 수집이 읽을 구간. `backfill`은 최근 구간 앞의 과거이고 없으면 `null`. */
export interface CalendarIngestionPlan {
    readonly recent: CalendarDateRange;
    readonly backfill: CalendarDateRange | null;
}

/**
 * 국가별 수집 구간을 ET 앵커일(`todayEt`)에서 계산한다.
 *
 * `recent`는 매시간 다시 읽는 구간(과거 `CALENDAR_RECENT_PAST_DAYS` ~ 미래
 * `CALENDAR_INGESTION_WINDOW_DAYS`)이고, 과거 창이 그보다 긴 국가(한국 180일)만 그 앞쪽을
 * `backfill`로 갖는다 — 두 구간은 겹치지 않는다(`backfill.to` = `recent.from` 전날).
 * `to`는 ET 앵커에서 계산되지만 저장된 `date`는 UTC 벽시계 문자열이라 UTC 기준보다 최대 하루
 * 좁을 수 있다(`calendarWindow.ts`의 "경계 오차") — 다음 수집이 그 하루를 편입한다.
 */
export function planCalendarIngestion(
    country: CalendarCountry,
    todayEt: string
): CalendarIngestionPlan {
    const pastDays = CALENDAR_PAST_WINDOW_DAYS[country];
    const recent: CalendarDateRange = {
        from: addUtcIsoDays(
            todayEt,
            -Math.min(pastDays, CALENDAR_RECENT_PAST_DAYS)
        ),
        to: addUtcIsoDays(todayEt, CALENDAR_INGESTION_WINDOW_DAYS),
    };
    const backfill =
        pastDays > CALENDAR_RECENT_PAST_DAYS
            ? {
                  from: addUtcIsoDays(todayEt, -pastDays),
                  to: addUtcIsoDays(recent.from, -1),
              }
            : null;
    return { recent, backfill };
}

/**
 * 이벤트를 PK(`economicCalendarId`)로 dedup해 `[id, event]` 쌍으로 돌려준다 — 뒤에 온 행이 이긴다.
 * 같은 id의 병렬 upsert는 동일 행 동시 갱신(deadlock)이라 쓰기 전에 반드시 거친다.
 */
export function dedupeCalendarEventsById(
    country: CalendarCountry,
    events: readonly EconomicCalendarEvent[]
): Array<readonly [string, EconomicCalendarEvent]> {
    return [
        ...new Map(
            events.map(
                event =>
                    [
                        economicCalendarId(country, event.date, event.event),
                        event,
                    ] as const
            )
        ).entries(),
    ];
}
