import 'server-only';
import { revalidateTag } from 'next/cache';

import { getDatabaseClient } from '@/shared/db/client';
import { FmpEconomyProvider } from '@/shared/api/fmp/FmpEconomyProvider';

import { DrizzleEconomicCalendarRepository } from './economicCalendarRepository';
import {
    isCalendarBackfillFresh,
    isCalendarRecentlyFetched,
    markCalendarBackfilled,
    markCalendarFetched,
} from './calendarRefreshFlag';
import { addUtcIsoDays } from '@/shared/lib/isoDate';
import { MS_PER_SECOND } from '@/shared/config/time';
import type { EconomicCalendarEvent } from '@y0ngha/siglens-core';
import { etDateOf } from '../lib/calendarWindow';
import { economicCalendarId } from '../lib/economicCalendarId';
import {
    CALENDAR_BACKFILL_FLAG_TTL_SECONDS,
    CALENDAR_MAJORITY_FAILURE_DIVISOR,
    CALENDAR_INGESTION_WINDOW_DAYS,
    CALENDAR_PAST_WINDOW_DAYS,
    CALENDAR_RECENT_PAST_DAYS,
    economyCalendarCacheTag,
} from '../lib/economyCalendarConstants';
import type { CalendarCountry } from '../model';

export type IngestEconomicCalendarResult =
    | { readonly status: 'recently-fetched' }
    | { readonly status: 'fetch-failed' }
    | { readonly status: 'write-failed' }
    | { readonly status: 'ok'; readonly changed: number };

/**
 * 이 프로세스에서 앞쪽 과거를 마지막으로 다 쓴 시각(국가별). Redis 플래그의 보조 가드다 — Redis가 죽으면
 * `isCalendarBackfillFresh`가 늘 false라, 수집마다 앞쪽 과거(FMP 조각 둘, 조각당 ~1MB)를 다시 읽게 된다.
 */
const backfilledAt = new Map<CalendarCountry, number>();

function backfilledRecentlyInProcess(country: CalendarCountry): boolean {
    const at = backfilledAt.get(country);
    return (
        at !== undefined &&
        Date.now() - at < CALENDAR_BACKFILL_FLAG_TTL_SECONDS * MS_PER_SECOND
    );
}

async function markBackfillDone(country: CalendarCountry): Promise<void> {
    backfilledAt.set(country, Date.now());
    await markCalendarBackfilled(country);
}

/** 테스트 전용 — 프로세스 내 백필 기록을 지운다. */
export function __resetBackfillMemoForTests(): void {
    backfilledAt.clear();
}

/** id 기준 dedup(뒤에 온 행이 이긴다) — `[id, event]` 쌍으로 돌려준다. */
function dedupeById(
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

/**
 * 최근 ±1개월(`CALENDAR_RECENT_PAST_DAYS` ~ 미래 `CALENDAR_INGESTION_WINDOW_DAYS`)의 FMP
 * economic-calendar를 fetch해 `economic_calendar`에 upsert하고, ≥1행이 실제로 변경되면 국가별
 * `economyCalendarCacheTag(country)` 태그를 무효화한다. 과거 창이 그보다 긴 국가(한국 180일)는 그 앞쪽을
 * 하루 한 번(`isCalendarBackfillFresh`) 함께 읽는다 — 실패해도 최근 구간은 그대로 쓴다.
 *
 * 방문자 경로(`ensureEconomicCalendarAction`)와 허브 프리웜 크론
 * (`app/api/cron/seo-prewarm/hubs.ts`)이 공유한다. 예전에는 방문자 브라우저가
 * `/economy`·`/economy/kr`을 열 때만 돌아서, 방문 전까지 캘린더와 그걸로 만드는
 * 한국 지표 카드가 비어 있었다(2026-10-01 허브 감사 A1) — 뉴스 카테고리
 * (`ingestMarketNewsCategory`)와 같은 처방이다.
 *
 * refresh-flag 가드(60분), graceful FMP 실패(DB 기존 데이터 유지), 과반 upsert 실패 시
 * abort. AI 분석 없음(`analyzeEconomicEvents`가 담당). 국가 검증·E2E 단락은 호출부 몫.
 * 그 밖의 예외(DB 등)는 올라간다 — 호출부가 각자의 격리 단위로 잡는다.
 */
export async function ingestEconomicCalendar(
    country: CalendarCountry,
    logLabel: string
): Promise<IngestEconomicCalendarResult> {
    if (await isCalendarRecentlyFetched(country)) {
        return { status: 'recently-fetched' };
    }
    // 플래그를 fetch 전에 set: 동시 마운트 dedup(news 패턴). 전량 실패 시 복구는 TTL 만료까지 대기.
    await markCalendarFetched(country);

    const today = etDateOf(new Date());
    const pastDays = CALENDAR_PAST_WINDOW_DAYS[country];
    const from = addUtcIsoDays(
        today,
        -Math.min(pastDays, CALENDAR_RECENT_PAST_DAYS)
    );
    // `to`는 ET 날짜 앵커에서 계산되지만 저장된 `date`는 UTC 벽시계 문자열이다
    // (calendarWindow.ts의 "경계 오차" 문서 참조) — 같은 비대칭이 여기 fetch
    // 윈도에도 적용돼 `to`가 UTC 기준보다 최대 하루 좁을 수 있다. 60분
    // refresh-flag TTL로 재호출이 잦고(CALENDAR_REFRESH_FLAG_TTL_SECONDS),
    // 미래 윈도가 14~30일로 넓어 그 하루는 다음 인제스션에서 자동 편입된다 —
    // 영구 드롭 아님, 의도적으로 미수정.
    const to = addUtcIsoDays(today, CALENDAR_INGESTION_WINDOW_DAYS);

    // 최근 구간보다 앞의 과거(한국 180일 창의 앞쪽)는 하루 한 번만 다시 읽는다 — 이미 발표된 값이다.
    const backfill =
        pastDays > CALENDAR_RECENT_PAST_DAYS &&
        !backfilledRecentlyInProcess(country) &&
        !(await isCalendarBackfillFresh(country))
            ? {
                  from: addUtcIsoDays(today, -pastDays),
                  to: addUtcIsoDays(from, -1),
              }
            : null;

    const provider = new FmpEconomyProvider();
    const [recent, older] = await Promise.all([
        provider
            .getCalendarForCountry(from, to, country)
            .catch((err: unknown) => {
                console.error(`[${logLabel}] FMP fetch failed:`, err);
                return null;
            }),
        backfill === null
            ? null
            : provider
                  .getCalendarForCountry(backfill.from, backfill.to, country)
                  .catch((err: unknown) => {
                      // 플래그를 세우지 않으므로 다음 수집이 다시 시도한다.
                      console.error(
                          `[${logLabel}] FMP backfill fetch failed:`,
                          err
                      );
                      return null;
                  }),
    ]);
    if (recent === null) return { status: 'fetch-failed' };

    // 최근 구간과 앞쪽 과거를 따로 센다. 하나로 합치면 앞쪽 ~150행이 분모를 키워 최근 구간 쓰기가 전부
    // 실패해도 과반에 못 미쳐 'ok'가 되고(새 `actual`이 조용히 안 들어간다), 앞쪽 일부만 실패해도
    // 하루짜리 플래그가 세워져 그 행들을 하루 동안 다시 시도하지 않는다.
    const recentRows = dedupeById(country, recent);
    const recentIds = new Set(recentRows.map(([id]) => id));
    // 두 구간은 날짜가 겹치지 않지만, 겹치면 최근 구간의 값이 이긴다.
    const olderRows = dedupeById(country, older ?? []).filter(
        ([id]) => !recentIds.has(id)
    );
    const rows = [...recentRows, ...olderRows];
    // 앞쪽 과거가 비어 오면 플래그를 세우지 않는다(SERVER.md#SA-18). 한국 180~31일 전 구간은 늘 발표가
    // 있다 — FMP는 장애 때도 200 `[]`를 줄 수 있고, 거기에 하루짜리 플래그를 세우면 하루 동안 재시도가 막힌다.
    const backfillComplete = (written: boolean): boolean =>
        older !== null && older.length > 0 && written;
    if (rows.length === 0) return { status: 'ok', changed: 0 };

    const { db } = getDatabaseClient();
    const repo = new DrizzleEconomicCalendarRepository(db);
    // 같은 id 이벤트의 병렬 upsert는 동일 행 동시 갱신 → deadlock 위험이라 id로 먼저 dedup했다.
    const settled = await Promise.allSettled(
        rows.map(([, event]) => repo.upsertEvent(country, event))
    );
    const recentSettled = settled.slice(0, recentRows.length);
    const olderSettled = settled.slice(recentRows.length);
    const failures = settled.filter(r => r.status === 'rejected');
    if (failures.length > 0) {
        console.error(
            `[${logLabel}] ${failures.length}/${rows.length} upserts failed`,
            failures.map(f => (f.status === 'rejected' ? f.reason : null))
        );
    }
    // 과반 판정은 최근 구간으로 한다(이번 수집의 본업). 최근 구간이 비면 앞쪽 과거로 판정한다.
    const judged = recentSettled.length > 0 ? recentSettled : olderSettled;
    const judgedFailures = judged.filter(r => r.status === 'rejected').length;
    if (judgedFailures > judged.length / CALENDAR_MAJORITY_FAILURE_DIVISOR) {
        console.error(
            `[${logLabel}] majority upsert failure (${judgedFailures}/${judged.length}) — aborting`
        );
        return { status: 'write-failed' };
    }

    // 앞쪽 과거가 한 행도 빠짐없이 써졌을 때만 하루짜리 플래그를 세운다. 일부라도 실패하면 다음 수집이
    // 다시 읽는다(최근 구간 플래그 TTL 60분 뒤).
    if (backfillComplete(olderSettled.every(r => r.status === 'fulfilled')))
        await markBackfillDone(country);
    const changedCount = settled.filter(
        r => r.status === 'fulfilled' && r.value === true
    ).length;
    if (changedCount > 0) {
        // 해당 국가의 캘린더 태그만 무효화 — 스냅샷(지표/treasury) ISR 캐시와, 다른
        // 국가의 캘린더 캐시는 건드리지 않는다.
        // Next 16 revalidateTag(tag, profile) — 'max'는 즉시 무효화.
        revalidateTag(economyCalendarCacheTag(country), 'max');
    }
    return { status: 'ok', changed: changedCount };
}
