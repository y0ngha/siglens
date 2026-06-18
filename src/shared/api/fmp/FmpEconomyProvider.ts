import {
    normalizeEconomicCalendar,
    normalizeEconomicIndicatorSeries,
    normalizeTreasuryRates,
    type EconomicCalendarEvent,
    type EconomicIndicatorSeries,
    type TreasuryRateSnapshot,
} from '@y0ngha/siglens-core';

import { fmpGet } from '@/shared/api/fmp/httpClient';
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
}
