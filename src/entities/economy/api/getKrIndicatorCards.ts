import { DEFAULT_LOCALE } from '@/shared/i18n/locales';
import 'server-only';
import { cache } from 'react';
import { unstable_cache } from 'next/cache';

import { getDatabaseClient } from '@/shared/db/client';
import { etDateTimeToKst } from '@/shared/lib/etTimeUtils';
import {
    KR_ECONOMY_INDICATORS,
    normalizeKrEventName,
    type KrEconomyIndicatorMeta,
} from '@/shared/config/economyIndicatorsKr';

import { DrizzleEconomicCalendarRepository } from './economicCalendarRepository';
import { addEtDays } from '../lib/calendarWindow';
import {
    CALENDAR_COUNTRY_KR,
    economyCalendarCacheTag,
    ECONOMY_CALENDAR_REVALIDATE_SECONDS,
    KR_INDICATOR_HISTORY_DAYS,
} from '../lib/economyCalendarConstants';

export interface KrIndicatorCard {
    meta: KrEconomyIndicatorMeta;
    /** 가장 최근 발표값. */
    latest: number;
    /**
     * 발표일 `YYYY-MM-DD` — **KST 달력일**.
     *
     * DB의 `date_et`는 ET 벽시계라 그대로 자르면 한국 아침 발표가 하루 앞으로
     * 밀린다(한국 CPI 08:00 KST = 전날 19:00 ET). 같은 행을 그리는 아래 캘린더는
     * 이미 `etDateTimeToKst`로 KST 키를 쓰므로, 카드만 ET로 두면 **같은 발표가
     * 카드와 캘린더에서 다른 날짜로** 보인다.
     */
    latestDate: string;
    /**
     * 직전 발표 대비 변화. 직전 발표가 없으면 `null` —
     * FMP `previous` 필드가 아니라 **우리가 가진 이력**에서 계산한다.
     * 두 값이 다를 때가 있는데(개정치 반영), 화면에 함께 그리는 추세와 어긋나지
     * 않으려면 같은 출처를 써야 한다.
     */
    changeFromPrevious: number | null;
}

/**
 * 한국 거시 지표 카드 — 경제 캘린더 발표 이력에서 되짚는다.
 *
 * **왜 지표 엔드포인트가 아닌가**: FMP `/economic-indicators`는 미국 시리즈만
 * 제공한다. 한국은 캘린더에 `actual`이 채워져 오므로(2026-08-18 실측: 180일 창
 * 63건), 발표 이력을 지표 시계열로 뒤집어 쓴다.
 *
 * ISR cold-gen 안전: Neon HTTP는 `no-store`라 정적 생성에서 `DYNAMIC_SERVER_USAGE`를
 * 던진다 — `unstable_cache`로 감싼다(`src/app/CLAUDE.md` 축 1). 캘린더와 같은 태그를
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

const fetchKrIndicatorCards = unstable_cache(
    async (anchorEt: string): Promise<KrIndicatorCard[]> => {
        const { db } = getDatabaseClient();
        const repo = new DrizzleEconomicCalendarRepository(db);
        const rows = await repo.listAnnouncedSince(
            CALENDAR_COUNTRY_KR,
            addEtDays(anchorEt, -KR_INDICATOR_HISTORY_DAYS)
        );

        // 이벤트명(기간 괄호 제거) → 발표 이력. repo가 dateEt 오름차순으로 주므로
        // 각 버킷도 오래된 → 최신 순이 그대로 유지된다.
        const byEvent = new Map<string, typeof rows>();
        for (const row of rows) {
            const key = normalizeKrEventName(row.event);
            const bucket = byEvent.get(key);
            if (bucket) bucket.push(row);
            else byEvent.set(key, [row]);
        }

        return KR_ECONOMY_INDICATORS.flatMap(meta => {
            const history = byEvent.get(meta.event);
            if (!history || history.length === 0) return [];

            const latest = history[history.length - 1];
            const prior = history[history.length - 2];

            return [
                {
                    meta,
                    latest: latest.actual,
                    latestDate: // `kstDateKey`만 읽으므로 로케일과 무관하다. 그래도 명시한다 —
                        // 기본값을 두면 호출부에서 빠져도 컴파일이 통과한다.
                        etDateTimeToKst(latest.dateEt, DEFAULT_LOCALE)
                            .kstDateKey,
                    changeFromPrevious:
                        prior === undefined
                            ? null
                            : latest.actual - prior.actual,
                },
            ];
        });
    },
    ['economy-kr-indicator-cards'],
    {
        revalidate: ECONOMY_CALENDAR_REVALIDATE_SECONDS,
        tags: [economyCalendarCacheTag(CALENDAR_COUNTRY_KR)],
    }
);
