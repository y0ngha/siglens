import {
    normalizeEconomicCalendar,
    normalizeEconomicIndicatorSeries,
    normalizeTreasuryRates,
    type EconomicCalendarEvent,
    type EconomicIndicatorSeries,
    type TreasuryRateSnapshot,
} from '@y0ngha/siglens-core';

import { fmpGet } from '@/shared/api/fmp/httpClient';
import { normalizeCalendarForCountry } from './normalizeCalendarForCountry';
import type { EconomyProvider } from '@/shared/api/economy/EconomyProvider';
import {
    ECONOMY_INDICATORS,
    INDICATOR_TREND_LENGTH,
} from '@/shared/config/economyIndicators';
import { ISO_DATE_LENGTH, SECONDS_PER_DAY } from '@/shared/config/time';

/**
 * Next.js Data Cache 갱신 주기 — 24h, /economy revalidate(86400)와 단일 TTL 공유.
 * 같은 상수가 양 계층(`unstable_cache` + Next data cache)에 박혀 드리프트를 막는다.
 */
const ECONOMY_REVALIDATE_SECONDS = SECONDS_PER_DAY;

/** FMP `/stable/*` 어댑터 — core 정규화에 위임. */
export class FmpEconomyProvider implements EconomyProvider {
    /**
     * `to` 없이 호출하면 FMP가 진행 중인(오래된) 창의 마지막 값을 돌려준다 —
     * 2026-09-14 실측: `to` 미지정 시 CPI 최신행이 2025-12-01에서 멈춰 있고,
     * `to=<오늘>`을 주면 2026-08-01(실제 최신)이 온다. 매 호출 시각 기준 오늘
     * 날짜를 넘겨 항상 최신 창을 요청한다.
     */
    async getIndicator(name: string): Promise<EconomicIndicatorSeries> {
        const to = new Date().toISOString().slice(0, ISO_DATE_LENGTH);
        const raw = await fmpGet<unknown>(
            'economic-indicators',
            { name, to },
            { revalidate: ECONOMY_REVALIDATE_SECONDS }
        );
        // Only '%'-unit (rate-type) registry entries are forwarded — core's
        // `unit` param drives the macro-briefing prompt's pp-delta vs
        // level-delta formatting, and only cares about the '%' case
        // (anything else, including omitting it, renders as level-type).
        // Passing e.g. `'pt'`/`'B$'` verbatim would be harmless but is not
        // what core's formatting switch checks for.
        const meta = ECONOMY_INDICATORS.find(m => m.name === name);
        return normalizeEconomicIndicatorSeries(
            name,
            raw,
            INDICATOR_TREND_LENGTH,
            meta?.unit === '%' ? '%' : undefined
        );
    }

    async getTreasury(): Promise<TreasuryRateSnapshot | null> {
        const raw = await fmpGet<unknown>(
            'treasury-rates',
            {},
            { revalidate: ECONOMY_REVALIDATE_SECONDS }
        );
        return normalizeTreasuryRates(raw);
    }

    async getCalendar(
        from: string,
        to: string
    ): Promise<EconomicCalendarEvent[]> {
        const raw = await fmpGet<unknown>(
            'economic-calendar',
            { from, to },
            { revalidate: ECONOMY_REVALIDATE_SECONDS }
        );
        return normalizeEconomicCalendar(raw);
    }

    /**
     * 국가를 지정해 캘린더를 읽는다. `getCalendar`(=US 전용, core 정규화)와 달리
     * 국가 필터를 siglens가 소유한다 — core `normalizeEconomicCalendar`는
     * `country === 'US'`를 하드코딩해서 한국 이벤트를 받을 수 없다.
     *
     * FMP는 한 번의 호출로 전 국가를 돌려주고 우리가 국가로 거른다.
     *
     * **두 국가가 같은 왕복을 공유하지는 않는다.** 조회 창이 다르기 때문이다
     * (`CALENDAR_PAST_WINDOW_DAYS` — US 30일 / KR 180일). `from`이 다르면 URL이
     * 달라 Next data cache 엔트리도 갈린다. 같은 국가의 재호출만 `revalidate`
     * 윈도 안에서 캐시를 탄다.
     *
     * KR 창은 210일(과거 180 + 미래 30)이다 — 플랜 상한(365일은 402) 안이고,
     * 2026-08-19 실측으로 200 + KR 94건을 확인했다.
     */
    async getCalendarForCountry(
        from: string,
        to: string,
        country: string
    ): Promise<EconomicCalendarEvent[]> {
        const raw = await fmpGet<unknown>(
            'economic-calendar',
            { from, to },
            { revalidate: ECONOMY_REVALIDATE_SECONDS }
        );
        return normalizeCalendarForCountry(raw, country);
    }
}
