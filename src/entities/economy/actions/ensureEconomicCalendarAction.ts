'use server';

import { revalidateTag } from 'next/cache';

import { getDatabaseClient } from '@/shared/db/client';
import { FmpEconomyProvider } from '@/shared/api/fmp/FmpEconomyProvider';

import { DrizzleEconomicCalendarRepository } from '../api/economicCalendarRepository';
import {
    isCalendarRecentlyFetched,
    markCalendarFetched,
} from '../api/calendarRefreshFlag';
import { addEtDays, etDateOf } from '../lib/calendarWindow';
import {
    CALENDAR_COUNTRY,
    CALENDAR_INGESTION_WINDOW_DAYS,
    ECONOMY_CALENDAR_CACHE_TAG,
} from '../lib/economyCalendarConstants';

/** upsert 과반 실패 시 abort 임계 분모. */
const MAJORITY_DIVISOR = 2;

/**
 * Server Action: ±1개월 윈도의 FMP economic-calendar를 fetch해 `economic_calendar`에
 * upsert하고, ≥1행이 실제로 변경되면 `economy:calendar` 태그를 무효화한다.
 *
 * `ensureMarketNewsCardsAnalyzedAction` 미러: refresh-flag 가드(봇 재크롤 시 fetch 생략),
 * graceful FMP 실패(빈 결과 X, DB 기존 데이터 유지), 과반 upsert 실패 시 abort.
 * AI 분석 없음(SP-D 별도). `waitUntil` 안에서 돌도록 설계 — 응답 스트림 비차단.
 */
export async function ensureEconomicCalendarAction(): Promise<void> {
    try {
        if (await isCalendarRecentlyFetched()) {
            return;
        }
        // async fetch 전에 마킹 — 동시 호출이 이 지점 이후 플래그를 읽으면 FMP 왕복 생략.
        await markCalendarFetched();

        const today = etDateOf(new Date());
        const from = addEtDays(today, -CALENDAR_INGESTION_WINDOW_DAYS);
        const to = addEtDays(today, CALENDAR_INGESTION_WINDOW_DAYS);

        const provider = new FmpEconomyProvider();
        const fresh = await provider
            .getCalendar(from, to)
            .catch((err: unknown) => {
                console.error(
                    '[ensureEconomicCalendarAction] FMP fetch failed:',
                    err
                );
                return null;
            });
        if (fresh === null || fresh.length === 0) return;

        const { db } = getDatabaseClient();
        const repo = new DrizzleEconomicCalendarRepository(db);

        const settled = await Promise.allSettled(
            fresh.map(event => repo.upsertEvent(CALENDAR_COUNTRY, event))
        );
        const failures = settled.filter(r => r.status === 'rejected');
        if (failures.length > 0) {
            console.error(
                `[ensureEconomicCalendarAction] ${failures.length}/${fresh.length} upserts failed`,
                failures.map(f => (f.status === 'rejected' ? f.reason : null))
            );
        }
        if (failures.length > fresh.length / MAJORITY_DIVISOR) {
            console.error(
                `[ensureEconomicCalendarAction] majority upsert failure (${failures.length}/${fresh.length}) — aborting`
            );
            return;
        }

        const changedCount = settled.filter(
            r => r.status === 'fulfilled' && r.value === true
        ).length;
        if (changedCount > 0) {
            // 'economy:calendar' 태그만 무효화 — 스냅샷(지표/treasury) ISR 캐시는 무관.
            // Next 16 revalidateTag(tag, profile) — 'max'는 즉시 무효화.
            revalidateTag(ECONOMY_CALENDAR_CACHE_TAG, 'max');
        }
    } catch (error) {
        console.error('[ensureEconomicCalendarAction]', error);
    }
}
