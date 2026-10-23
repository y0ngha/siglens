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
import type {
    CountryCalendars,
    EconomyProvider,
} from '@/shared/api/economy/EconomyProvider';
import {
    ECONOMY_INDICATORS,
    INDICATOR_TREND_LENGTH,
} from '@/shared/config/economyIndicators';
import { addUtcIsoDays, toUtcIsoDate } from '@/shared/lib/isoDate';
import { MS_PER_DAY } from '@/shared/config/time';
import { FMP_CALENDAR_MAX_SPAN_DAYS } from '@/shared/config/economyCalendar';

interface DateRange {
    from: string;
    to: string;
}

/**
 * `from`~`to`(양끝 포함)를 FMP 한 번에 온전히 오는 조각으로 나눈다. 각 조각은
 * {@link FMP_CALENDAR_MAX_SPAN_DAYS}일 이하이고 날짜가 겹치지 않는다(FMP가 UTC 날짜로 거르므로
 * 조각 경계의 행이 두 번 오지 않는다).
 */
export function splitCalendarRange(from: string, to: string): DateRange[] {
    const spanDays =
        Math.round((Date.parse(to) - Date.parse(from)) / MS_PER_DAY) + 1;
    if (!(spanDays > 0)) return [{ from, to }];
    const count = Math.ceil(spanDays / FMP_CALENDAR_MAX_SPAN_DAYS);
    return Array.from({ length: count }, (_, i) => {
        const start = addUtcIsoDays(from, i * FMP_CALENDAR_MAX_SPAN_DAYS);
        const end = addUtcIsoDays(start, FMP_CALENDAR_MAX_SPAN_DAYS - 1);
        return { from: start, to: end < to ? end : to };
    });
}

/**
 * 범위를 {@link splitCalendarRange}로 나눠 읽고 행을 이어 붙인다. 배열이 아닌 응답(FMP는 한도·오류도
 * 200 객체로 준다)은 던진다 — 빈 조각으로 넘기면 90일이 통째로 빠진 결과가 성공으로 읽혀, 하루짜리
 * 백필 플래그까지 세워진다. 호출부는 모두 실패를 잡아 degrade한다.
 */
async function fetchEconomicCalendar(
    from: string,
    to: string
): Promise<unknown[]> {
    const parts = await Promise.all(
        splitCalendarRange(from, to).map(range =>
            fmpGet<unknown>('economic-calendar', { ...range })
        )
    );
    return parts.flatMap(part => {
        if (!Array.isArray(part))
            throw new Error('FMP economic-calendar returned a non-array body');
        return part;
    });
}

/** FMP `/stable/*` 어댑터 — core 정규화에 위임. */
export class FmpEconomyProvider implements EconomyProvider {
    /**
     * `to` 없이 호출하면 FMP가 진행 중인(오래된) 창의 마지막 값을 돌려준다 —
     * 2026-09-14 실측: `to` 미지정 시 CPI 최신행이 2025-12-01에서 멈춰 있고,
     * `to=<오늘>`을 주면 2026-08-01(실제 최신)이 온다. 매 호출 시각 기준 오늘
     * 날짜를 넘겨 항상 최신 창을 요청한다.
     */
    async getIndicator(name: string): Promise<EconomicIndicatorSeries> {
        const to = toUtcIsoDate(new Date());
        const raw = await fmpGet<unknown>('economic-indicators', { name, to });
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
        const raw = await fmpGet<unknown>('treasury-rates');
        return normalizeTreasuryRates(raw);
    }

    async getCalendar(
        from: string,
        to: string
    ): Promise<EconomicCalendarEvent[]> {
        return normalizeEconomicCalendar(await fetchEconomicCalendar(from, to));
    }

    /**
     * 국가를 지정해 캘린더를 읽는다. `getCalendar`(=US 전용, core 정규화)와 달리
     * 국가 필터를 siglens가 소유한다 — core `normalizeEconomicCalendar`는
     * `country === 'US'`를 하드코딩해서 한국 이벤트를 받을 수 없다.
     *
     * FMP는 한 번의 호출로 전 국가를 돌려주고 우리가 국가로 거른다.
     *
     * **이 메서드는 부를 때마다 FMP를 새로 읽는다.** `fmpGet`에 데이터 캐시가 없어서, 같은 범위를
     * 국가마다 부르면 같은 전 국가 응답을 국가 수만큼 받는다(매시간 수집이 그렇게 쓴다 — 발표된
     * `actual`이 바로 들어와야 한다, `fmpGet` JSDoc 참고). 여러 국가를 한 번에 읽으려면
     * {@link FmpEconomyProvider.getCalendarsByCountry}를 쓴다.
     *
     * {@link FMP_CALENDAR_MAX_SPAN_DAYS}일보다 긴 범위는 나눠 읽는다. 한때 한국의 210일
     * 창을 한 번에 읽어 앞쪽 약 120일이 조용히 빠졌다(2026-08-19 실측 "KR 94건"이 그 절단이었다).
     */
    async getCalendarForCountry(
        from: string,
        to: string,
        country: string
    ): Promise<EconomicCalendarEvent[]> {
        return normalizeCalendarForCountry(
            await fetchEconomicCalendar(from, to),
            country
        );
    }

    async getCalendarsByCountry(
        from: string,
        to: string,
        countries: readonly string[]
    ): Promise<CountryCalendars> {
        const raw = await fetchEconomicCalendar(from, to);
        return {
            byCountry: Object.fromEntries(
                countries.map(country => [
                    country,
                    country === 'US'
                        ? normalizeEconomicCalendar(raw)
                        : normalizeCalendarForCountry(raw, country),
                ])
            ),
            sourceRows: raw.length,
        };
    }
}
