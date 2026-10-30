import 'server-only';
import { cache } from 'react';
import { unstable_cache } from 'next/cache';

import { getDatabaseClient } from '@/shared/db/client';
import { addUtcIsoDays } from '@/shared/lib/isoDate';

import { DrizzleEconomicCalendarRepository } from './economicCalendarRepository';
import {
    CALENDAR_COUNTRY_KR,
    economyCalendarCacheTag,
    ECONOMY_CALENDAR_REVALIDATE_SECONDS,
    KR_INDICATOR_HISTORY_DAYS,
} from '../lib/economyCalendarConstants';
import {
    buildKrIndicatorCards,
    type KrIndicatorCard,
} from '../lib/krIndicatorCards';

const fetchKrIndicatorCards = unstable_cache(
    async (anchorEt: string): Promise<KrIndicatorCard[]> => {
        const { db } = getDatabaseClient();
        const repo = new DrizzleEconomicCalendarRepository(db);
        const rows = await repo.listAnnouncedSince(
            CALENDAR_COUNTRY_KR,
            addUtcIsoDays(anchorEt, -KR_INDICATOR_HISTORY_DAYS)
        );
        return buildKrIndicatorCards(rows);
    },
    ['economy-kr-indicator-cards'],
    {
        revalidate: ECONOMY_CALENDAR_REVALIDATE_SECONDS,
        tags: [economyCalendarCacheTag(CALENDAR_COUNTRY_KR)],
    }
);

/**
 * 한국 거시 지표 카드 — 경제 캘린더 발표 이력에서 되짚는다.
 *
 * **왜 지표 엔드포인트가 아닌가**: FMP `/economic-indicators`는 미국 시리즈만
 * 제공한다. 한국은 캘린더에 `actual`이 채워져 오므로(2026-08-18 실측: 180일 창
 * 63건), 발표 이력을 지표 시계열로 뒤집어 쓴다.
 *
 * ISR cold-gen 안전: DB 쿼리는 drizzle 로거의 `unstable_noStore`(`noStoreQueryLogger`)로
 * 정적 생성에서 `DYNAMIC_SERVER_USAGE`를 던진다 — `unstable_cache`로 감싼다(`src/app/CLAUDE.md` 축 1). 캘린더와 같은 태그를
 * 쓰므로 인제스션이 캘린더를 무효화하면 카드도 함께 갱신된다.
 *
 * DB 실패는 빈 배열로 graceful — 지표 섹션만 비고 페이지는 렌더된다.
 */
export const getKrIndicatorCards = cache(
    async (anchorEt: string): Promise<KrIndicatorCard[]> => {
        try {
            return await fetchKrIndicatorCards(anchorEt);
        } catch (error) {
            console.error('[getKrIndicatorCards] DB read failed:', error);
            return [];
        }
    }
);
