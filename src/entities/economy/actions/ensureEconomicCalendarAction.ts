'use server';

import { revalidateTag } from 'next/cache';

import { isE2E } from '@/shared/api/e2eEnv';
import { getDatabaseClient } from '@/shared/db/client';
import { FmpEconomyProvider } from '@/shared/api/fmp/FmpEconomyProvider';

import { DrizzleEconomicCalendarRepository } from '../api/economicCalendarRepository';
import {
    isCalendarRecentlyFetched,
    markCalendarFetched,
} from '../api/calendarRefreshFlag';
import { addEtDays, etDateOf } from '../lib/calendarWindow';
import { economicCalendarId } from '../lib/economicCalendarId';
import {
    CALENDAR_COUNTRY,
    CALENDAR_INGESTION_WINDOW_DAYS,
    CALENDAR_PAST_WINDOW_DAYS,
    economyCalendarCacheTag,
    type CalendarCountry,
    isCalendarCountry,
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
/**
 * @param country - 수집할 국가. 기본값은 미국이라 기존 호출부(`/economy`)가 그대로
 *   동작한다. 한국 라우트는 `'KR'`을 넘긴다 — refresh-flag도 국가별로 갈려 있어
 *   한쪽 인제스션이 다른 쪽을 건너뛰게 만들지 않는다.
 */
export async function ensureEconomicCalendarAction(
    country: CalendarCountry = CALENDAR_COUNTRY
): Promise<void> {
    try {
        if (isE2E()) return;
        // 직렬화를 건너온 공개 인자라 런타임에서 좁힌다 — `isCalendarCountry` JSDoc 참조.
        if (!isCalendarCountry(country)) {
            console.error(
                '[ensureEconomicCalendarAction] unknown country:',
                country
            );
            return;
        }
        if (await isCalendarRecentlyFetched(country)) {
            return;
        }
        // 플래그를 fetch 전에 set: 동시 마운트 dedup(news 패턴). 전량 실패 시 복구는 TTL 만료까지 대기.
        await markCalendarFetched(country);

        const today = etDateOf(new Date());
        const from = addEtDays(today, -CALENDAR_PAST_WINDOW_DAYS[country]);
        const to = addEtDays(today, CALENDAR_INGESTION_WINDOW_DAYS);

        const provider = new FmpEconomyProvider();
        const fresh = await provider
            .getCalendarForCountry(from, to, country)
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

        // 같은 id 이벤트의 병렬 upsert는 동일 행 동시 갱신 → deadlock 위험. 먼저 id 기준 dedup.
        const deduped = [
            ...new Map(
                fresh.map(
                    event =>
                        [
                            economicCalendarId(
                                country,
                                event.date,
                                event.event
                            ),
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
                `[ensureEconomicCalendarAction] ${failures.length}/${deduped.length} upserts failed`,
                failures.map(f => (f.status === 'rejected' ? f.reason : null))
            );
        }
        if (failures.length > deduped.length / MAJORITY_DIVISOR) {
            console.error(
                `[ensureEconomicCalendarAction] majority upsert failure (${failures.length}/${deduped.length}) — aborting`
            );
            return;
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
    } catch (error) {
        console.error('[ensureEconomicCalendarAction]', error);
    }
}
