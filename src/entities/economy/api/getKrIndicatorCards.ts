import 'server-only';
import { cache } from 'react';
import { unstable_cache } from 'next/cache';

import { getDatabaseClient } from '@/shared/db/client';
import {
    KR_ECONOMY_INDICATORS,
    normalizeKrEventName,
    type KrEconomyIndicatorMeta,
} from '@/shared/config/economyIndicatorsKr';

import { DrizzleEconomicCalendarRepository } from './economicCalendarRepository';
import { addEtDays } from '../lib/calendarWindow';
import {
    CALENDAR_COUNTRY_KR,
    ECONOMY_CALENDAR_CACHE_TAG,
    ECONOMY_CALENDAR_REVALIDATE_SECONDS,
    KR_INDICATOR_HISTORY_DAYS,
} from '../lib/economyCalendarConstants';

/** 카드 하나가 그리는 미니 추세의 최대 포인트 수. 미국 카드(12)와 같은 축척. */
export const KR_TREND_MAX_POINTS = 12;

/**
 * 추세선을 그리기 위한 최소 포인트 수.
 *
 * 2점짜리 "추세"는 선분 하나라 정보가 없고, 오히려 데이터가 충분하다는 인상을 준다.
 * FMP 캘린더 조회 상한(과거 ~180일) 때문에 초기에는 월간 지표가 5~6점이므로, 이
 * 문턱을 넘지 못하는 지표는 추세를 숨기고 최신값만 보여준다.
 */
export const KR_TREND_MIN_POINTS = 4;

export interface KrIndicatorCard {
    meta: KrEconomyIndicatorMeta;
    /** 가장 최근 발표값. */
    latest: number;
    /** 발표일 `YYYY-MM-DD`(ET 벽시계 기준 날짜 부분). */
    latestDate: string;
    /**
     * 직전 발표 대비 변화. 직전 발표가 없으면 `null` —
     * FMP `previous` 필드가 아니라 **우리가 가진 이력**에서 계산한다.
     * 두 값이 다를 때가 있는데(개정치 반영), 화면에 함께 그리는 추세와 어긋나지
     * 않으려면 같은 출처를 써야 한다.
     */
    changeFromPrevious: number | null;
    /** 오래된 → 최신 순. 길이가 {@link KR_TREND_MIN_POINTS} 미만이면 빈 배열. */
    trend: readonly number[];
}

/** `YYYY-MM-DD HH:mm:ss` → `YYYY-MM-DD`. */
const DATE_ONLY_LENGTH = 10;

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
            const trend = history
                .slice(-KR_TREND_MAX_POINTS)
                .map(point => point.actual);

            return [
                {
                    meta,
                    latest: latest.actual,
                    latestDate: latest.dateEt.slice(0, DATE_ONLY_LENGTH),
                    changeFromPrevious:
                        prior === undefined
                            ? null
                            : latest.actual - prior.actual,
                    trend: trend.length >= KR_TREND_MIN_POINTS ? trend : [],
                },
            ];
        });
    },
    ['economy-kr-indicator-cards'],
    {
        revalidate: ECONOMY_CALENDAR_REVALIDATE_SECONDS,
        tags: [ECONOMY_CALENDAR_CACHE_TAG],
    }
);

/** 카드가 하나도 없으면 degrade(빈 페이지 색인 방지)로 본다. */
export function isEmptyKrIndicatorSet(cards: readonly KrIndicatorCard[]) {
    return cards.length === 0;
}
