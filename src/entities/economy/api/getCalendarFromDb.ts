import 'server-only';
import { cache } from 'react';
import { unstable_cache } from 'next/cache';

import { getDatabaseClient } from '@/shared/db/client';

import { DrizzleEconomicCalendarRepository } from './economicCalendarRepository';
import type { EconomicCalendarEventWithAnalysis } from '../model';
import { pastWindowStart, futureWindowEnd } from '../lib/calendarWindow';
import {
    CALENDAR_COUNTRY,
    economyCalendarCacheTag,
    ECONOMY_CALENDAR_REVALIDATE_SECONDS,
    type CalendarCountry,
} from '../lib/economyCalendarConstants';

/**
 * `anchorEt`를 인자로 받아 Next.js ISR 캐시에 올리는 모듈-레벨 래퍼.
 * `unstable_cache`는 함수 인자를 자동으로 캐시 키에 포함하므로 날짜가
 * 바뀌면 자연히 새 윈도로 리프레시된다.
 *
 * ISR cold-gen 안전: `@neondatabase/serverless` HTTP는 no-store라 static
 * generate가 `DYNAMIC_SERVER_USAGE`를 throw한다 — `unstable_cache`로 감싸
 * HTML에 박고 정적화한다 (src/app/CLAUDE.md 4축 규약 축1).
 * revalidate=24h + `economy:calendar` 태그로 `ensureEconomicCalendarAction`이
 * on-demand 무효화 가능. cookies/headers/connection 미사용.
 *
 * SP-D: `listInRange`가 AI 분석 컬럼(sentiment/summaryKo/interpretationKo/analyzedAt)을
 * 함께 반환하므로 반환 타입이 `EconomicCalendarEventWithAnalysis[]`로 확장됐다.
 */
/**
 * 국가별로 **별도의** `unstable_cache` 래퍼를 만든다.
 *
 * 하나의 래퍼에 두 국가 태그를 모두 선언하면 어느 쪽 인제스션이든 두 엔트리를 다
 * 날려, 태그를 가른 의미가 없어진다(`tags`는 호출 인자가 아니라 래퍼 생성 시 고정된다).
 * 래퍼는 국가당 하나씩만 만들어 모듈 수명 동안 재사용한다.
 */
const calendarReaders = new Map<
    CalendarCountry,
    (anchorEt: string) => Promise<EconomicCalendarEventWithAnalysis[]>
>();

function calendarReaderFor(country: CalendarCountry) {
    const existing = calendarReaders.get(country);
    if (existing) return existing;

    const reader = unstable_cache(
        async (
            anchorEt: string
        ): Promise<EconomicCalendarEventWithAnalysis[]> => {
            const { db } = getDatabaseClient();
            const repo = new DrizzleEconomicCalendarRepository(db);
            return repo.listInRange(
                pastWindowStart(anchorEt),
                futureWindowEnd(anchorEt),
                country
            );
        },
        ['economy-calendar-db', country],
        {
            revalidate: ECONOMY_CALENDAR_REVALIDATE_SECONDS,
            tags: [economyCalendarCacheTag(country)],
        }
    );
    calendarReaders.set(country, reader);
    return reader;
}

/**
 * 과거 2주 + 미래 윈도의 캘린더 이벤트를 DB에서 읽는다.
 *
 * `anchorEt`는 호출자(페이지 RSC)가 ET-오늘을 1회 계산해 주입하며, 모듈-레벨
 * `unstable_cache` 래퍼(`fetchCalendar`)에 인자로 전달 — `Date.now()` 없음.
 * React.cache로 요청 내 dedup(metadata/본문 중복 호출 대비).
 *
 * DB 실패 시 빈 배열로 graceful — 캘린더 섹션만 비고 페이지는 렌더.
 */
export const getCalendarFromDb = cache(
    async (
        anchorEt: string,
        country: CalendarCountry = CALENDAR_COUNTRY
    ): Promise<EconomicCalendarEventWithAnalysis[]> => {
        try {
            // 국가는 래퍼 키(`['economy-calendar-db', country]`)에 들어가므로
            // 미국·한국이 같은 엔트리를 공유할 수 없다.
            return await calendarReaderFor(country)(anchorEt);
        } catch (error) {
            console.error('[getCalendarFromDb] DB read failed:', error);
            return [];
        }
    }
);
