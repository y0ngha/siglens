import 'server-only';
import { cache } from 'react';
import { unstable_cache } from 'next/cache';
import type { EconomicCalendarEvent } from '@y0ngha/siglens-core';

import { getDatabaseClient } from '@/shared/db/client';

import { DrizzleEconomicCalendarRepository } from './economicCalendarRepository';
import { pastWindowStart, futureWindowEnd } from '../lib/calendarWindow';
import {
    ECONOMY_CALENDAR_CACHE_TAG,
    ECONOMY_CALENDAR_REVALIDATE_SECONDS,
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
 */
const fetchCalendar = unstable_cache(
    async (anchorEt: string): Promise<EconomicCalendarEvent[]> => {
        const { db } = getDatabaseClient();
        const repo = new DrizzleEconomicCalendarRepository(db);
        return repo.listInRange(
            pastWindowStart(anchorEt),
            futureWindowEnd(anchorEt)
        );
    },
    ['economy-calendar-db'],
    {
        revalidate: ECONOMY_CALENDAR_REVALIDATE_SECONDS,
        tags: [ECONOMY_CALENDAR_CACHE_TAG],
    }
);

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
    async (anchorEt: string): Promise<EconomicCalendarEvent[]> => {
        try {
            return await fetchCalendar(anchorEt);
        } catch (error) {
            console.error('[getCalendarFromDb] DB read failed:', error);
            return [];
        }
    }
);
