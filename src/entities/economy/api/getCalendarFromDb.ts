import 'server-only';
import { cache } from 'react';
import { unstable_cache } from 'next/cache';

import { getDatabaseClient } from '@/shared/db/client';
import { localizeContent } from '@/shared/db/localizeContent';
import {
    CONTENT_FIELD,
    TRANSLATABLE_ENTITY,
} from '@/shared/db/contentTranslationFields';
import { contentLocaleKeyPart } from '@/shared/cache/contentLocaleKeyPart';
import { DEFAULT_LOCALE, type Locale } from '@/shared/i18n/locales';

import { DrizzleEconomicCalendarRepository } from './economicCalendarRepository';
import { economicCalendarId } from '../lib/economicCalendarId';
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
    string,
    (anchorEt: string) => Promise<EconomicCalendarEventWithAnalysis[]>
>();

/**
 * 로케일은 **캐시 키 조각으로만** 넘긴다 — `unstable_cache` 인자로 넘기면
 * 사이드카가 꺼져 있어도 로케일 수만큼 키가 갈려 ISR write가 4배가 된다.
 * `contentLocaleKeyPart`가 꺼짐 상태에서 빈 배열을 주므로, 스위치를 켤 때만
 * 그 비용을 낸다.
 */
function calendarReaderFor(country: CalendarCountry, locale: Locale) {
    const keyPart = contentLocaleKeyPart(locale);
    const mapKey = [country, ...keyPart].join(':');
    const existing = calendarReaders.get(mapKey);
    if (existing) return existing;

    const reader = unstable_cache(
        async (
            anchorEt: string
        ): Promise<EconomicCalendarEventWithAnalysis[]> => {
            const { db } = getDatabaseClient();
            const repo = new DrizzleEconomicCalendarRepository(db);
            const rows = await repo.listInRange(
                pastWindowStart(anchorEt),
                futureWindowEnd(anchorEt),
                country
            );
            // 캐시 **안에서** 해석한다. 밖에서 하면 한 블롭이 로케일마다 다른
            // 값을 내야 해서 먼저 생성된 로케일이 전 로케일에 굳는다.
            return localizeCalendarRows(rows, country, locale);
        },
        ['economy-calendar-db', country, ...keyPart],
        {
            revalidate: ECONOMY_CALENDAR_REVALIDATE_SECONDS,
            tags: [economyCalendarCacheTag(country)],
        }
    );
    calendarReaders.set(mapKey, reader);
    return reader;
}

/**
 * AI 요약·해석을 요청 로케일로 해석해 `*Localized`에 담는다.
 *
 * 사이드카에 그 로케일 행이 있을 때만 채운다 — 폴백이면 비워 두고 렌더가
 * 한국어 원문을 쓰게 한다. 폴백 값을 넣으면 캐시 블롭이 로케일에 의존하게
 * 되는데, 스위치가 꺼진 동안엔 키가 갈리지 않아 교차 오염이 된다.
 */
async function localizeCalendarRows(
    rows: EconomicCalendarEventWithAnalysis[],
    country: CalendarCountry,
    locale: Locale
): Promise<EconomicCalendarEventWithAnalysis[]> {
    if (locale === DEFAULT_LOCALE) return rows;

    const localized = await localizeContent({
        entity: TRANSLATABLE_ENTITY.economicCalendar,
        rows,
        locale,
        // PK를 다시 계산한다 — `listInRange`가 `id`를 select하지 않기 때문이다.
        // 넣으면 이벤트당 64자 hex가 RSC 페이로드에 실린다(이 레포는 그 비용을
        // 실제로 잰다 — `docs/architecture/`). 해시는 결정론적이라 재계산이 안전하다.
        id: row => economicCalendarId(country, row.date, row.event),
        fields: {
            summary: {
                field: CONTENT_FIELD.economicCalendar.summary,
                legacy: row => ({ ko: row.summaryKo }),
            },
            interpretation: {
                field: CONTENT_FIELD.economicCalendar.interpretation,
                legacy: row => ({ ko: row.interpretationKo }),
            },
        },
    });

    return localized.map(row => {
        const next: EconomicCalendarEventWithAnalysis = { ...row };
        if (row.localized.summary?.fromSidecar === true) {
            next.summaryLocalized = row.localized.summary.value;
        }
        if (row.localized.interpretation?.fromSidecar === true) {
            next.interpretationLocalized = row.localized.interpretation.value;
        }
        return next;
    });
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
        country: CalendarCountry = CALENDAR_COUNTRY,
        locale: Locale = DEFAULT_LOCALE
    ): Promise<EconomicCalendarEventWithAnalysis[]> => {
        try {
            // 국가는 래퍼 키(`['economy-calendar-db', country]`)에 들어가므로
            // 미국·한국이 같은 엔트리를 공유할 수 없다.
            return await calendarReaderFor(country, locale)(anchorEt);
        } catch (error) {
            console.error('[getCalendarFromDb] DB read failed:', error);
            return [];
        }
    }
);
