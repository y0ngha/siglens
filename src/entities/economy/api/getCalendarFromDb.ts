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
 * 과거 2주 + 미래 윈도의 캘린더 이벤트를 DB에서 읽는다.
 *
 * ISR cold-gen 안전: `@neondatabase/serverless` HTTP는 no-store라 static generate가
 * `DYNAMIC_SERVER_USAGE`를 throw한다 — `unstable_cache`로 감싸 HTML에 박고 정적화한다
 * (src/app/CLAUDE.md 4축 규약 축1). revalidate=24h + `economy:calendar` 태그로
 * `ensureEconomicCalendarAction`이 on-demand 무효화 가능. cookies/headers/connection
 * 미사용, `anchorEt`는 호출자(페이지 RSC)가 ET-오늘을 1회 계산해 주입 → `Date.now()` 없음.
 *
 * DB 실패 시 빈 배열로 graceful — 캘린더 섹션만 비고 페이지는 렌더.
 *
 * `anchorEt`를 캐시 키 파트에 넣어 날짜가 바뀌면 자연히 새 윈도로 리프레시한다.
 * React.cache로 요청 내 dedup(metadata/본문 중복 호출 대비).
 */
export const getCalendarFromDb = cache(
    (anchorEt: string): Promise<EconomicCalendarEvent[]> =>
        unstable_cache(
            async () => {
                try {
                    const { db } = getDatabaseClient();
                    const repo = new DrizzleEconomicCalendarRepository(db);
                    return await repo.listInRange(
                        pastWindowStart(anchorEt),
                        futureWindowEnd(anchorEt)
                    );
                } catch (error) {
                    console.error('[getCalendarFromDb] DB read failed:', error);
                    return [];
                }
            },
            ['economy-calendar-db', anchorEt],
            {
                revalidate: ECONOMY_CALENDAR_REVALIDATE_SECONDS,
                tags: [ECONOMY_CALENDAR_CACHE_TAG],
            }
        )()
);
