import 'server-only';
import { revalidateTag } from 'next/cache';

import { getDatabaseClient } from '@/shared/db/client';
import { FmpEconomyProvider } from '@/shared/api/fmp/FmpEconomyProvider';

import { DrizzleEconomicCalendarRepository } from './economicCalendarRepository';
import {
    isCalendarRecentlyFetched,
    markCalendarFetched,
} from './calendarRefreshFlag';
import { addEtDays, etDateOf } from '../lib/calendarWindow';
import { economicCalendarId } from '../lib/economicCalendarId';
import {
    CALENDAR_MAJORITY_FAILURE_DIVISOR,
    CALENDAR_INGESTION_WINDOW_DAYS,
    CALENDAR_PAST_WINDOW_DAYS,
    economyCalendarCacheTag,
    type CalendarCountry,
} from '../lib/economyCalendarConstants';

export type IngestEconomicCalendarResult =
    | { readonly status: 'recently-fetched' }
    | { readonly status: 'fetch-failed' }
    | { readonly status: 'write-failed' }
    | { readonly status: 'ok'; readonly changed: number };

/**
 * ±1개월 윈도의 FMP economic-calendar를 fetch해 `economic_calendar`에 upsert하고,
 * ≥1행이 실제로 변경되면 국가별 `economyCalendarCacheTag(country)` 태그를 무효화한다.
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
    const from = addEtDays(today, -CALENDAR_PAST_WINDOW_DAYS[country]);
    // `to`는 ET 날짜 앵커에서 계산되지만 저장된 `date`는 UTC 벽시계 문자열이다
    // (calendarWindow.ts의 "경계 오차" 문서 참조) — 같은 비대칭이 여기 fetch
    // 윈도에도 적용돼 `to`가 UTC 기준보다 최대 하루 좁을 수 있다. 60분
    // refresh-flag TTL로 재호출이 잦고(CALENDAR_REFRESH_FLAG_TTL_SECONDS),
    // 미래 윈도가 14~30일로 넓어 그 하루는 다음 인제스션에서 자동 편입된다 —
    // 영구 드롭 아님, 의도적으로 미수정.
    const to = addEtDays(today, CALENDAR_INGESTION_WINDOW_DAYS);

    const provider = new FmpEconomyProvider();
    const fresh = await provider
        .getCalendarForCountry(from, to, country)
        .catch((err: unknown) => {
            console.error(`[${logLabel}] FMP fetch failed:`, err);
            return null;
        });
    if (fresh === null) return { status: 'fetch-failed' };
    if (fresh.length === 0) return { status: 'ok', changed: 0 };

    const { db } = getDatabaseClient();
    const repo = new DrizzleEconomicCalendarRepository(db);

    // 같은 id 이벤트의 병렬 upsert는 동일 행 동시 갱신 → deadlock 위험. 먼저 id 기준 dedup.
    const deduped = [
        ...new Map(
            fresh.map(
                event =>
                    [
                        economicCalendarId(country, event.date, event.event),
                        event,
                    ] as const
            )
        ).values(),
    ];

    const settled = await Promise.allSettled(
        deduped.map(event => repo.upsertEvent(country, event))
    );
    const failures = settled.filter(r => r.status === 'rejected');
    if (failures.length > 0) {
        console.error(
            `[${logLabel}] ${failures.length}/${deduped.length} upserts failed`,
            failures.map(f => (f.status === 'rejected' ? f.reason : null))
        );
    }
    if (failures.length > deduped.length / CALENDAR_MAJORITY_FAILURE_DIVISOR) {
        console.error(
            `[${logLabel}] majority upsert failure (${failures.length}/${deduped.length}) — aborting`
        );
        return { status: 'write-failed' };
    }

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
