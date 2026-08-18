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
import { INDICATOR_TREND_LENGTH } from '@/shared/config/economyIndicators';
import { SECONDS_PER_DAY } from '@/shared/config/time';

/**
 * Next.js Data Cache 갱신 주기 — 24h, /economy revalidate(86400)와 단일 TTL 공유.
 * 같은 상수가 양 계층(`unstable_cache` + Next data cache)에 박혀 드리프트를 막는다.
 */
const ECONOMY_REVALIDATE_SECONDS = SECONDS_PER_DAY;

/** FMP `/stable/*` 어댑터 — core 정규화에 위임. */
export class FmpEconomyProvider implements EconomyProvider {
    async getIndicator(name: string): Promise<EconomicIndicatorSeries> {
        const raw = await fmpGet<unknown>(
            'economic-indicators',
            { name },
            { revalidate: ECONOMY_REVALIDATE_SECONDS }
        );
        return normalizeEconomicIndicatorSeries(
            name,
            raw,
            INDICATOR_TREND_LENGTH
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
     * FMP는 한 번의 호출로 전 국가를 돌려주므로, 같은 창을 두 국가가 각각
     * 호출하면 응답 전체를 두 번 받는다. `fmpGet`이 `revalidate`로 Next data
     * cache에 태워 실제 왕복은 한 번이다(같은 URL·같은 창).
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
